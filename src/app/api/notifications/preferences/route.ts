import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

// GET /api/notifications/preferences
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
    if (!dbUser) return NextResponse.json({ preferences: [] });

    const prefs = await prisma.notificationPreference.findMany({ where: { userId: dbUser.id } });
    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/notifications/preferences — upsert a preference
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { alertType, enabled } = await req.json();

    const pref = await prisma.notificationPreference.upsert({
      where: { userId_alertType: { userId: dbUser.id, alertType } },
      update: { enabled },
      create: { userId: dbUser.id, alertType, enabled },
    });

    return NextResponse.json({ preference: pref });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
