import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { crawlAndScore } from "@/lib/crawler/engine";
import { createNotification, isAlertEnabled } from "@/lib/notifications";

// This route is called by Vercel Cron — secured with CRON_SECRET
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const dayOfMonth = now.getDate();

  // Determine which frequencies are due to run today
  const frequenciesToRun: string[] = ["DAILY"];
  if (dayOfWeek === 1) frequenciesToRun.push("WEEKLY"); // Every Monday
  if (dayOfMonth === 1) frequenciesToRun.push("MONTHLY"); // 1st of each month

  const websites = await prisma.website.findMany({
    where: { scanFrequency: { in: frequenciesToRun as any } },
    include: { organization: { include: { members: { include: { user: true } } } } },
  });

  console.log(`[CRON] Running scheduled scans for ${websites.length} websites (${frequenciesToRun.join(", ")})`);

  const results = [];
  for (const website of websites) {
    try {
      // Check if already scanned within the last 23 hours (prevent duplicate runs)
      const recentScan = await prisma.scan.findFirst({
        where: { websiteId: website.id, createdAt: { gte: new Date(Date.now() - 23 * 60 * 60 * 1000) } },
      });
      if (recentScan) {
        results.push({ websiteId: website.id, skipped: true });
        continue;
      }

      const previousScan = await prisma.scan.findFirst({
        where: { websiteId: website.id, status: "COMPLETED" },
        orderBy: { createdAt: 'desc' },
      });

      const scan = await prisma.scan.create({
        data: { websiteId: website.id, status: "RUNNING", startedAt: new Date() },
      });

      const result = await crawlAndScore(website.url, website.id, 20);

      for (const crawledPage of result.pages) {
        const page = await prisma.page.upsert({
          where: { websiteId_url: { websiteId: website.id, url: crawledPage.url } },
          update: { title: crawledPage.title, metaDesc: crawledPage.metaDesc, h1: crawledPage.h1, textContent: crawledPage.textContent },
          create: { websiteId: website.id, url: crawledPage.url, title: crawledPage.title, metaDesc: crawledPage.metaDesc, h1: crawledPage.h1, textContent: crawledPage.textContent },
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

      await prisma.scan.update({
        where: { id: scan.id },
        data: { status: "COMPLETED", completedAt: new Date(), overallScore: result.overallScore },
      });

      // Change detection & notify each owner/manager
      if (previousScan?.overallScore !== null && previousScan?.overallScore !== undefined) {
        const scoreDiff = result.overallScore - previousScan.overallScore;
        if (scoreDiff !== 0) {
          await prisma.seoChange.create({
            data: { websiteId: website.id, field: "score", before: previousScan.overallScore.toString(), after: result.overallScore.toString(), impact: Math.abs(scoreDiff) > 10 ? "high" : "low" }
          });

          if (scoreDiff < 0) {
            const hostname = new URL(website.url).hostname;
            for (const member of website.organization.members) {
              if (await isAlertEnabled(member.userId, "score_drop")) {
                await createNotification({
                  userId: member.userId,
                  organizationId: website.organizationId,
                  type: "score_drop",
                  message: `[Scheduled Scan] SEO score for ${hostname} dropped from ${previousScan.overallScore} to ${result.overallScore}.`,
                  userEmail: member.user.email,
                  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
                  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
                });
              }
            }
          }
        }
      }

      results.push({ websiteId: website.id, score: result.overallScore, pagesScanned: result.pages.length });
    } catch (err: any) {
      console.error(`[CRON] Failed to scan ${website.url}:`, err.message);
      results.push({ websiteId: website.id, error: err.message });
    }
  }

  return NextResponse.json({ ran: results.length, results });
}
