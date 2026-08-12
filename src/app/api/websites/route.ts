import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { url, scanFrequency } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Get or create the user's organization (for now, one org per user)
    let dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.full_name || user.email!.split("@")[0],
        },
      });
    }

    // Find or create the default organization for this user
    let org = await prisma.organizationMember.findFirst({
      where: { userId: dbUser.id },
      include: { organization: true },
    });

    if (!org) {
      const newOrg = await prisma.organization.create({
        data: {
          name: `${dbUser.name || "My"}'s Organization`,
          members: {
            create: {
              userId: dbUser.id,
              role: "OWNER",
            },
          },
        },
      });
      org = await prisma.organizationMember.findFirst({
        where: { userId: dbUser.id, organizationId: newOrg.id },
        include: { organization: true },
      });
    }

    // Check for duplicate
    const existing = await prisma.website.findFirst({
      where: {
        organizationId: org!.organizationId,
        url,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This website is already being monitored." },
        { status: 409 }
      );
    }

    // Create the website
    const website = await prisma.website.create({
      data: {
        url,
        scanFrequency: scanFrequency || "WEEKLY",
        organizationId: org!.organizationId,
      },
    });

    // Notify about website addition
    import("@/lib/notifications").then(({ createNotification }) => {
      createNotification({
        organizationId: website.organizationId,
        type: "minor_seo_change",
        message: `Website added: ${website.url}`,
      });
    }).catch(console.error);

    return NextResponse.json({ website }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/websites]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
    if (!dbUser) {
      return NextResponse.json({ websites: [] });
    }

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: dbUser.id },
      include: {
        organization: {
          include: {
            websites: {
              include: {
                scans: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    const websites = memberships.flatMap((m) => m.organization.websites);

    return NextResponse.json({ websites });
  } catch (err) {
    console.error("[GET /api/websites]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
