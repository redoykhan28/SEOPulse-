import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public report endpoint — no auth, used by the shareable /report/[slug] page
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const report = await prisma.report.findUnique({
      where: { publicSlug: slug },
      include: {
        website: {
          include: {
            scans: {
              where: { status: "COMPLETED" },
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { seoIssues: true },
            },
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const latestScan = report.website.scans[0];
    if (!latestScan) {
      return NextResponse.json({ error: "No scan data available for this report" }, { status: 404 });
    }

    return NextResponse.json({
      report: {
        siteUrl: report.website.url,
        month: report.month,
        overallScore: latestScan.overallScore ?? 0,
        scannedAt: latestScan.completedAt?.toISOString() ?? latestScan.createdAt.toISOString(),
        issues: latestScan.seoIssues,
      },
    });
  } catch (err) {
    console.error("[GET /api/reports/[slug]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
