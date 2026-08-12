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

export async function DELETE(
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

    const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { organization: { include: { members: { include: { user: true } } } } },
    });

    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const isMember = website.organization.members.some(m => m.userId === dbUser.id);
    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.website.delete({
      where: { id: websiteId }
    });

    // Notify all org members about website deletion
    import("@/lib/notifications").then(({ createNotification }) => {
      const memberEmails = website.organization.members
        .map((m: any) => m.user?.email)
        .filter(Boolean) as string[];
      
      createNotification({
        organizationId: website.organizationId,
        type: "website_deleted",
        message: `Website removed from monitoring: ${website.url}`,
        userEmail: memberEmails[0],
        additionalEmails: memberEmails.slice(1),
      });
    }).catch(console.error);

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    console.error("[DELETE /api/websites/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { scanFrequency, notifyEmails, enabledAlerts } = body;

    const updatedWebsite = await prisma.website.update({
      where: { id: websiteId },
      data: {
        ...(scanFrequency && { scanFrequency }),
        ...(notifyEmails && Array.isArray(notifyEmails) && { notifyEmails }),
        ...(enabledAlerts && Array.isArray(enabledAlerts) && { enabledAlerts }),
      }
    });

    return NextResponse.json({ website: updatedWebsite }, { status: 200 });

  } catch (err) {
    console.error("[PATCH /api/websites/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
