import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { crawlAndScore } from "@/lib/crawler/engine";
import { createNotification, isAlertEnabled } from "@/lib/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { organization: { include: { members: true } } },
    });
    if (!website) return NextResponse.json({ error: "Website not found" }, { status: 404 });

    const isMember = website.organization.members.some(m => m.userId === dbUser.id);
    if (!isMember) return NextResponse.json({ error: "Unauthorized to scan this website" }, { status: 403 });

    // Fetch previous scan for Change Detection
    const previousScan = await prisma.scan.findFirst({
      where: { websiteId, status: "COMPLETED" },
      orderBy: { createdAt: 'desc' }
    });

    const scan = await prisma.scan.create({
      data: { websiteId, status: "RUNNING", startedAt: new Date() },
    });

    try {
      const result = await crawlAndScore(website.url, websiteId, 20);

      for (const crawledPage of result.pages) {
        const page = await prisma.page.upsert({
          where: { websiteId_url: { websiteId, url: crawledPage.url } },
          update: {
            title: crawledPage.title,
            metaDesc: crawledPage.metaDesc,
            h1: crawledPage.h1,
            textContent: crawledPage.textContent
          },
          create: {
            websiteId,
            url: crawledPage.url,
            title: crawledPage.title,
            metaDesc: crawledPage.metaDesc,
            h1: crawledPage.h1,
            textContent: crawledPage.textContent
          },
        });

        await prisma.seoIssue.createMany({
          data: crawledPage.issues.map(issue => ({
            scanId: scan.id,
            pageId: page.id,
            checkType: issue.ruleId,
            passed: issue.passed,
            severity: issue.severity === 'ERROR' ? 'FAILED' : 'WARNING',
            details: issue.details,
          })) as any,
        });
      }

      const updatedScan = await prisma.scan.update({
        where: { id: scan.id },
        data: { status: "COMPLETED", completedAt: new Date(), overallScore: result.overallScore },
      });

      // ── Change Detection + Notifications ─────────────────────────────────
      const hostname = new URL(website.url).hostname;

      if (previousScan && previousScan.overallScore !== null) {
        const scoreDiff = result.overallScore - previousScan.overallScore;

        if (scoreDiff !== 0) {
          const impact = Math.abs(scoreDiff) > 10 ? "high" : "low";
          await prisma.seoChange.create({
            data: { websiteId, field: "score", before: previousScan.overallScore.toString(), after: result.overallScore.toString(), impact }
          });

          // Fire score_drop notification if score dropped
          if (scoreDiff < 0 && await isAlertEnabled(dbUser.id, "score_drop")) {
            await createNotification({
              userId: dbUser.id,
              organizationId: website.organizationId,
              type: "score_drop",
              message: `⬇ SEO score for ${hostname} dropped from ${previousScan.overallScore} to ${result.overallScore} (${Math.abs(scoreDiff)} point drop).`,
              userEmail: user.email ?? undefined,
              slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
              discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
            });
          }
        }
      }

      return NextResponse.json({ scan: updatedScan });

    } catch (crawlerError: any) {
      console.error("Crawler error:", crawlerError);
      const failedScan = await prisma.scan.update({
        where: { id: scan.id },
        data: { status: "FAILED", completedAt: new Date() },
      });
      return NextResponse.json({ error: "Crawler failed", scan: failedScan }, { status: 500 });
    }

  } catch (err) {
    console.error("[POST /api/websites/[id]/scan]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
