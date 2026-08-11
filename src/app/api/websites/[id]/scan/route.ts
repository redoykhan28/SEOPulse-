import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { crawlAndScore } from "@/lib/crawler/engine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { organization: { include: { members: true } } },
    });

    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const isMember = website.organization.members.some(m => m.userId === dbUser.id);
    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized to scan this website" }, { status: 403 });
    }

    // Fetch previous scan for Change Detection
    const previousScan = await prisma.scan.findFirst({
      where: { websiteId, status: "COMPLETED" },
      orderBy: { createdAt: 'desc' }
    });

    // Create a new scan record
    const scan = await prisma.scan.create({
      data: {
        websiteId,
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    try {
      // 1. Run the crawler (crawls up to 20 pages)
      const result = await crawlAndScore(website.url, websiteId, 20);

      // 2. Process each crawled page
      for (const crawledPage of result.pages) {
        // Save the page content to the DB for Keyword Gap Analysis
        const page = await prisma.page.upsert({
          where: {
            websiteId_url: {
              websiteId,
              url: crawledPage.url,
            },
          },
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

        // 3. Save the SeoIssues for this page
        const seoIssuesData = crawledPage.issues.map(issue => ({
          scanId: scan.id,
          pageId: page.id,
          checkType: issue.ruleId,
          passed: issue.passed,
          severity: issue.severity === 'ERROR' ? 'FAILED' : 'WARNING',
          details: issue.details,
        }));

        await prisma.seoIssue.createMany({
          data: seoIssuesData as any,
        });
      }

      // 4. Update the Scan with completion status and score
      const updatedScan = await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          overallScore: result.overallScore,
        },
      });

      // 5. Change Detection (Compare to previous scan)
      if (previousScan && previousScan.overallScore !== null) {
        if (previousScan.overallScore !== result.overallScore) {
          const impact = Math.abs(previousScan.overallScore - result.overallScore) > 10 ? "high" : "low";
          
          await prisma.seoChange.create({
            data: {
              websiteId,
              field: "score",
              before: previousScan.overallScore.toString(),
              after: result.overallScore.toString(),
              impact: impact
            }
          });
        }
      }

      return NextResponse.json({ scan: updatedScan });
      
    } catch (crawlerError: any) {
      // Handle crawler failure
      console.error("Crawler error:", crawlerError);
      const failedScan = await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
        },
      });
      return NextResponse.json({ error: "Crawler failed", scan: failedScan }, { status: 500 });
    }

  } catch (err) {
    console.error("[POST /api/websites/[id]/scan]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
