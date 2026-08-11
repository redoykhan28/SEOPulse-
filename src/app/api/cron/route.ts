import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  });

  console.log(`[CRON] Initializing scheduled scans for ${websites.length} websites (${frequenciesToRun.join(", ")})`);

  let initializedCount = 0;
  for (const website of websites) {
    try {
      // Check if already scanned within the last 23 hours (prevent duplicate runs)
      const recentScan = await prisma.scan.findFirst({
        where: { websiteId: website.id, createdAt: { gte: new Date(Date.now() - 23 * 60 * 60 * 1000) } },
      });
      if (recentScan) continue;

      const scan = await prisma.scan.create({
        data: { 
          websiteId: website.id, 
          status: "RUNNING", 
          startedAt: new Date(),
          pendingUrls: JSON.stringify([website.url]),
          scannedUrls: JSON.stringify([])
        },
      });

      // API CHAINING: Trigger the process endpoint asynchronously
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `http://${req.headers.get('host')}`;
      
      // Fire and forget (fetch without await)
      fetch(`${baseUrl}/api/cron/process`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.CRON_SECRET}`
        },
        body: JSON.stringify({ scanId: scan.id })
      }).catch(e => console.error("Failed to kick off background chunk:", e));
      
      initializedCount++;
    } catch (err: any) {
      console.error(`[CRON] Failed to initialize scan for ${website.url}:`, err.message);
    }
  }

  return NextResponse.json({ initialized: initializedCount });
}
