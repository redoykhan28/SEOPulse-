import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processCrawlChunk } from "@/lib/crawler/engine";
import { createNotification, isAlertEnabled } from "@/lib/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    
    // We expect the scanId in the body
    const body = await req.json().catch(() => ({}));
    const scanId = body.scanId;

    if (!scanId) {
      return NextResponse.json({ error: "scanId required" }, { status: 400 });
    }

    const scan = await prisma.scan.findUnique({
      where: { id: scanId, websiteId },
      include: { website: { include: { organization: { include: { members: { include: { user: true } } } } } } }
    });

    if (!scan || scan.status !== "RUNNING") {
      return NextResponse.json({ error: "Scan not running or not found" }, { status: 400 });
    }

    // Process a chunk of 20 URLs
    const result = await processCrawlChunk(scan.id, 20);

    if (result.isComplete) {
      // Calculate overall score
      const issues = await prisma.seoIssue.findMany({ where: { scanId: scan.id } });
      const passedCount = issues.filter(i => i.passed).length;
      const totalCount = issues.length;
      
      const overallScore = totalCount === 0 ? 0 : Math.round((passedCount / totalCount) * 100);

      const updatedScan = await prisma.scan.update({
        where: { id: scan.id },
        data: { status: "COMPLETED", completedAt: new Date(), overallScore },
      });

      // Change Detection & Notifications
      const previousScan = await prisma.scan.findFirst({
        where: { websiteId, status: "COMPLETED", id: { not: scan.id } },
        orderBy: { createdAt: 'desc' }
      });

      if (previousScan && previousScan.overallScore !== null) {
        const scoreDiff = overallScore - previousScan.overallScore;

        if (scoreDiff !== 0) {
          const impact = Math.abs(scoreDiff) > 10 ? "high" : "low";
          await prisma.seoChange.create({
            data: { websiteId, field: "score", before: previousScan.overallScore.toString(), after: overallScore.toString(), impact }
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
                  message: `⬇ SEO score for ${hostname} dropped from ${previousScan.overallScore} to ${overallScore}.`,
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

      return NextResponse.json({ status: "COMPLETED", scan: updatedScan });
    }

    return NextResponse.json({ 
      status: "RUNNING", 
      pagesCrawledThisChunk: result.pagesCrawled,
      remainingQueue: result.remainingQueue
    });

  } catch (err: any) {
    console.error("[POST /api/websites/[id]/scan/process]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
