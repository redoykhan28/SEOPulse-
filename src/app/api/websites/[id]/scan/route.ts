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

    // Create a new scan record
    const scan = await prisma.scan.create({
      data: {
        websiteId,
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    try {
      // 1. Run the crawler
      const result = await crawlAndScore(website.url, websiteId);

      // 2. Save the homepage as a Page record (if not exists)
      const page = await prisma.page.upsert({
        where: {
          websiteId_url: {
            websiteId,
            url: website.url,
          },
        },
        update: {},
        create: {
          websiteId,
          url: website.url,
        },
      });

      // 3. Save the SeoIssues
      const seoIssuesData = result.issues.map(issue => ({
        scanId: scan.id,
        pageId: page.id,
        checkType: issue.ruleId,
        passed: issue.passed,
        severity: issue.severity === 'ERROR' ? 'FAILED' : 'WARNING', // Map to Prisma Severity enum
        details: issue.details,
      }));

      await prisma.seoIssue.createMany({
        data: seoIssuesData as any,
      });

      // 4. Update the Scan with completion status and score
      const updatedScan = await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          overallScore: result.overallScore,
        },
      });

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
