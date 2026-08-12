import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";

type KeywordRow = {
  keyword: string;
  volume: number | null;
  difficulty: number | null;
};

type PageContent = {
  url: string;
  title: string | null;
  metaDesc: string | null;
  h1: string | null;
  textContent: string | null;
};

// ─── No-AI: Word-match keyword against page content ─────────────────────────
function matchKeywordToPages(keyword: string, pages: PageContent[]): {
  status: "targeted" | "partially targeted" | "not targeted";
  suggestedPage: string | null;
} {
  const kw = keyword.toLowerCase().trim();
  const kwWords = kw.split(/\s+/);
  let bestPage: string | null = null;
  let bestScore = 0;

  for (const page of pages) {
    const haystack = [
      page.url.toLowerCase(),
      (page.title || "").toLowerCase(),
      (page.h1 || "").toLowerCase(),
      (page.metaDesc || "").toLowerCase(),
      (page.textContent || "").toLowerCase(),
    ].join(" ");

    // Exact match in title/h1/URL = "targeted"
    const isExact =
      page.title?.toLowerCase().includes(kw) ||
      page.h1?.toLowerCase().includes(kw) ||
      page.url.toLowerCase().includes(kw.replace(/\s+/g, "-")) ||
      page.url.toLowerCase().includes(kw.replace(/\s+/g, "_"));

    if (isExact) {
      return { status: "targeted", suggestedPage: page.url };
    }

    // Partial match: count how many words of the keyword appear in content
    const wordMatches = kwWords.filter(w => haystack.includes(w)).length;
    const score = wordMatches / kwWords.length;

    if (score > bestScore) {
      bestScore = score;
      bestPage = page.url;
    }
  }

  if (bestScore >= 0.5) {
    return { status: "partially targeted", suggestedPage: bestPage };
  }

  return { status: "not targeted", suggestedPage: bestPage };
}

// ─── GET: Fetch saved keyword matches for this website ───────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const keywordFiles = await prisma.keywordFile.findMany({
      where: { websiteId },
      include: { matches: { orderBy: [{ volume: "desc" }, { difficulty: "asc" }] } },
      orderBy: { uploadedAt: "desc" },
      take: 1,
    });

    return NextResponse.json({ keywordFile: keywordFiles[0] || null });
  } catch (err) {
    console.error("[GET /api/websites/[id]/keywords]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Process uploaded keywords against crawled page content ────────────
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
    if (!isMember) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await req.json();
    const { keywords, filename, useAI = false } = body as {
      keywords: KeywordRow[];
      filename: string;
      useAI?: boolean;
    };

    if (!keywords || keywords.length === 0) {
      return NextResponse.json({ error: "No keywords provided" }, { status: 400 });
    }

    // Fetch crawled pages for this website
    const pages = await prisma.page.findMany({
      where: { websiteId },
      select: { url: true, title: true, metaDesc: true, h1: true, textContent: true },
    });

    if (pages.length === 0) {
      return NextResponse.json({ error: "No pages crawled yet. Run a Deep Audit first." }, { status: 400 });
    }

    let matches: {
      keyword: string;
      volume: number | null;
      difficulty: number | null;
      matchStatus: string;
      suggestedPage: string | null;
    }[] = [];

    // ── No-AI (string matching) ──────────────────────────────────────────────
    for (const kw of keywords) {
      const { status, suggestedPage } = matchKeywordToPages(kw.keyword, pages);
      matches.push({
        keyword: kw.keyword,
        volume: kw.volume,
        difficulty: kw.difficulty,
        matchStatus: status,
        suggestedPage,
      });
    }

    // ── AI Enhancement via OpenRouter (optional) ─────────────────────────────
    if (useAI && process.env.OPENROUTER_API_KEY) {
      try {
        const notTargeted = matches.filter(m => m.matchStatus !== "targeted");
        const keywordList = notTargeted.map(m => m.keyword).join(", ");
        
        // Take up to 30 pages and chunk them into groups of 15
        const pagesToAnalyze = pages.slice(0, 30);
        const CHUNK_SIZE = 15;
        const pageChunks: typeof pages[] = [];
        
        for (let i = 0; i < pagesToAnalyze.length; i += CHUNK_SIZE) {
          pageChunks.push(pagesToAnalyze.slice(i, i + CHUNK_SIZE));
        }

        const fetchPromises = pageChunks.map(chunk => {
          const pageContext = chunk.map(p =>
            `URL: ${p.url}\nTitle: ${p.title || ''}\nH1: ${p.h1 || ''}\nDescription: ${p.metaDesc || ''}`
          ).join("\n---\n");

          const prompt = `You are an SEO expert. Below are pages crawled from a website and a list of keywords that were NOT matched by simple string matching.

CRAWLED PAGES:
${pageContext}

UNMATCHED KEYWORDS: ${keywordList}

For each keyword, determine:
1. If any existing page semantically covers it (return: {"keyword": "...", "status": "targeted", "page": "url"})
2. If no page covers it (return: {"keyword": "...", "status": "not targeted", "page": null})

Return ONLY a valid JSON array of objects with keys: keyword, status, page. No explanation.`;

          return fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "X-Title": "SEOPulse Keyword Analysis",
            },
            body: JSON.stringify({
              model: OPENROUTER_MODEL,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.1,
            }),
          }).then(r => r.json());
        });

        // Run all chunks in parallel
        const results = await Promise.all(fetchPromises);

        for (const aiData of results) {
          const rawContent = aiData.choices?.[0]?.message?.content || "[]";
          const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              const aiMatches: { keyword: string; status: string; page: string | null }[] = JSON.parse(jsonMatch[0]);
              // Merge AI results back
              for (const aiMatch of aiMatches) {
                const existing = matches.find(m => m.keyword.toLowerCase() === aiMatch.keyword.toLowerCase());
                if (existing && existing.matchStatus === "not targeted" && aiMatch.status === "targeted") {
                  existing.matchStatus = "targeted (AI)";
                  existing.suggestedPage = aiMatch.page;
                }
              }
            } catch (e) {
              // Ignore parse errors for individual chunks
            }
          }
        }
      } catch (aiErr) {
        console.warn("OpenRouter AI enhancement failed, continuing with string-match results:", aiErr);
      }
    }

    // Save to DB
    const keywordFile = await prisma.keywordFile.create({
      data: {
        organizationId: website.organizationId,
        websiteId,
        filename,
        matches: {
          create: matches.map(m => ({
            keyword: m.keyword,
            volume: m.volume,
            difficulty: m.difficulty,
            matchStatus: m.matchStatus,
            suggestedPage: m.suggestedPage,
          })),
        },
      },
      include: { matches: { orderBy: [{ volume: "desc" }, { difficulty: "asc" }] } },
    });

    return NextResponse.json({ keywordFile });
  } catch (err) {
    console.error("[POST /api/websites/[id]/keywords]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
