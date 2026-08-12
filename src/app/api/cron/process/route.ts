import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processCrawlChunk } from "@/lib/crawler/engine";
import { createNotification, isAlertEnabled } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const scanId = body.scanId;

    if (!scanId) {
      return NextResponse.json({ error: "scanId required" }, { status: 400 });
    }

    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: { website: { include: { organization: { include: { members: { include: { user: true } } } } } } }
    });

    if (!scan || scan.status !== "RUNNING") {
      return NextResponse.json({ error: "Scan not running or not found" }, { status: 400 });
    }

    // Process a chunk of 40 URLs (Cron can handle slightly larger chunks safely within 60s)
    const result = await processCrawlChunk(scan.id, 40);

    if (result.isComplete) {
      // Calculate overall score
      const issues = await prisma.seoIssue.findMany({ where: { scanId: scan.id } });
      const passedCount = issues.filter(i => i.passed).length;
      const totalCount = issues.length;
      
      const overallScore = totalCount === 0 ? 0 : Math.round((passedCount / totalCount) * 100);

      await prisma.scan.update({
        where: { id: scan.id },
        data: { status: "COMPLETED", completedAt: new Date(), overallScore },
      });

      // Change Detection & Notifications
      const previousScan = await prisma.scan.findFirst({
        where: { websiteId: scan.websiteId, status: "COMPLETED", id: { not: scan.id } },
        orderBy: { createdAt: 'desc' }
      });

      if (previousScan && previousScan.overallScore !== null) {
        const scoreDiff = overallScore - previousScan.overallScore;

        if (scoreDiff !== 0) {
          const impact = Math.abs(scoreDiff) > 10 ? "high" : "low";
          await prisma.seoChange.create({
            data: { websiteId: scan.websiteId, field: "score", before: previousScan.overallScore.toString(), after: overallScore.toString(), impact }
          });

          // Fire notifications
          if (scoreDiff < 0) {
            const hostname = new URL(scan.website.url).hostname;
            const additionalEmails = (scan.website as any).notifyEmails as string[] || [];
            for (const member of scan.website.organization.members) {
              if (await isAlertEnabled(member.userId, "score_drop")) {
                await createNotification({
                  userId: member.userId,
                  organizationId: scan.website.organizationId,
                  type: "score_drop",
                  message: `[Scheduled Scan] ⬇ SEO score for ${hostname} dropped from ${previousScan.overallScore} to ${overallScore}.`,
                  userEmail: member.user.email,
                  additionalEmails,
                  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
                  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
                });
              }
            }
          }
        }
      }

      console.log(`[CRON PROCESS] Scan ${scan.id} COMPLETED. Score: ${overallScore}`);
      return NextResponse.json({ status: "COMPLETED" });
    }

    // API CHAINING: If not complete, call itself again asynchronously to process the next chunk
    console.log(`[CRON PROCESS] Scan ${scan.id} chunk finished. Remaining: ${result.remainingQueue}. Chaining next chunk...`);
    
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `http://${req.headers.get('host')}`;
    
    fetch(`${baseUrl}/api/cron/process`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.CRON_SECRET}`
      },
      body: JSON.stringify({ scanId: scan.id })
    }).catch(e => console.error("Failed to chain next cron chunk:", e));

    return NextResponse.json({ 
      status: "RUNNING", 
      pagesCrawledThisChunk: result.pagesCrawled,
      remainingQueue: result.remainingQueue
    });

  } catch (err: any) {
    console.error("[POST /api/cron/process]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
