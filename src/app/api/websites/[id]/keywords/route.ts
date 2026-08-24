import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/auto";

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

// ─── Helper: Escape Regex ────────────────────────────────────────────────────
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── No-AI: Word-match keyword against page content ─────────────────────────
function matchKeywordToPages(keyword: string, pages: PageContent[]): {
  status: "targeted" | "partially targeted" | "not targeted" | "cannibalized";
  suggestedPage: string | null;
} {
  const kw = keyword.toLowerCase().trim();
  const kwWords = kw.split(/\s+/);
  let bestPage: string | null = null;
  let bestScore = 0;

  const kwRegex = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i');
  const kwHyphen = kw.replace(/\s+/g, "-");
  const kwUnderscore = kw.replace(/\s+/g, "_");

  const exactMatches: string[] = [];

  for (const page of pages) {
    const haystack = [
      page.url.toLowerCase(),
      (page.title || "").toLowerCase(),
      (page.h1 || "").toLowerCase(),
      (page.metaDesc || "").toLowerCase(),
      (page.textContent || "").toLowerCase(),
    ].join(" ");

    // Exact match in title/h1 using word boundaries, or URL substring
    const isExact =
      kwRegex.test(page.title || "") ||
      kwRegex.test(page.h1 || "") ||
      page.url.toLowerCase().includes(kwHyphen) ||
      page.url.toLowerCase().includes(kwUnderscore);

    if (isExact) {
      exactMatches.push(page.url);
    }

    // Partial match: count how many words of the keyword appear in content using word boundaries
    const wordMatches = kwWords.filter(w => new RegExp(`\\b${escapeRegExp(w)}\\b`, 'i').test(haystack)).length;
    const score = wordMatches / kwWords.length;

    if (score > bestScore) {
      bestScore = score;
      bestPage = page.url;
    }
  }

  if (exactMatches.length > 1) {
    return { status: "cannibalized", suggestedPage: exactMatches.join(", ") };
  } else if (exactMatches.length === 1) {
    return { status: "targeted", suggestedPage: exactMatches[0] };
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

    // Deduplicate keywords (keep highest volume/difficulty)
    const uniqueKeywords = new Map<string, KeywordRow>();
    for (const kw of keywords) {
      const key = kw.keyword.toLowerCase().trim();
      if (!uniqueKeywords.has(key)) {
        uniqueKeywords.set(key, kw);
      } else {
        const existing = uniqueKeywords.get(key)!;
        if ((kw.volume || 0) > (existing.volume || 0)) {
          uniqueKeywords.set(key, kw);
        } else if (kw.volume === existing.volume && (kw.difficulty || 0) > (existing.difficulty || 0)) {
          uniqueKeywords.set(key, kw);
        }
      }
    }
    const dedupedKeywords = Array.from(uniqueKeywords.values());

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
    for (const kw of dedupedKeywords) {
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
        // Chunk keywords to prevent LLM output truncation (max 40 per prompt)
        const KW_CHUNK_SIZE = 40;
        const kwChunks: string[][] = [];
        for (let i = 0; i < notTargeted.length; i += KW_CHUNK_SIZE) {
          kwChunks.push(notTargeted.slice(i, i + KW_CHUNK_SIZE).map(m => m.keyword));
        }

        // Prioritize "main" pages for AI analysis by sorting by URL depth (fewer slashes = higher priority)
        // Then by URL length to prefer shorter URLs among the same depth
        const sortedPagesForAI = [...pages].sort((a, b) => {
          const depthA = (a.url.match(/\//g) || []).length;
          const depthB = (b.url.match(/\//g) || []).length;
          if (depthA !== depthB) return depthA - depthB;
          return a.url.length - b.url.length;
        });

        // We can send all 30 top pages in one context since we only send meta/headers, not full text.
        const pagesToAnalyze = sortedPagesForAI.slice(0, 30);
        const pageContext = pagesToAnalyze.map(p =>
          `URL: ${p.url}\nTitle: ${p.title || ''}\nH1: ${p.h1 || ''}\nDescription: ${p.metaDesc || ''}`
        ).join("\n---\n");

        const fetchPromises = kwChunks.map(kwChunk => {
          const keywordList = kwChunk.join(", ");

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
              "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://seopulse.app",
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
                if (existing && existing.matchStatus !== "targeted" && existing.matchStatus !== "cannibalized") {
                  if (aiMatch.status === "targeted" && aiMatch.page) {
                    // Hallucination check: Verify the URL exists in the crawled pages
                    const pageExists = pages.some(p => p.url === aiMatch.page);
                    if (pageExists) {
                      existing.matchStatus = "targeted (AI)";
                      existing.suggestedPage = aiMatch.page;
                    }
                  } else if (aiMatch.status === "not targeted") {
                    existing.matchStatus = "not targeted";
                    existing.suggestedPage = null;
                  }
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
