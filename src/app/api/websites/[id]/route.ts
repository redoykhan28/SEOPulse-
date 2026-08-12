import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
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

    // Verify ownership & fetch website
    const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { 
        organization: { include: { members: true } },
        pages: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, url: true, title: true, createdAt: true }
        },
        scans: {
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: {
            seoIssues: {
              include: { page: { select: { url: true, title: true } } }
            }
          }
        },
        seoChanges: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      },
    });

    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const isMember = website.organization.members.some(m => m.userId === dbUser.id);
    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ website }, { status: 200 });

  } catch (err) {
    console.error("[GET /api/websites/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
