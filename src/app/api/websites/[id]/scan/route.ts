import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

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

    // Initialize the queue state for the new scan
    const scan = await prisma.scan.create({
      data: { 
        websiteId, 
        status: "RUNNING", 
        startedAt: new Date(),
        pendingUrls: JSON.stringify([website.url]),
        scannedUrls: JSON.stringify([])
      },
    });

    return NextResponse.json({ status: "INITIALIZED", scanId: scan.id });

  } catch (err) {
    console.error("[POST /api/websites/[id]/scan]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
