import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { keywords } = body as { keywords: string[] };

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "Keywords array is required" }, { status: 400 });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "OpenRouter API key is missing" }, { status: 500 });
    }

    // Slice to top 50 to avoid huge context
    const keywordsToCluster = keywords.slice(0, 50);

    const prompt = `You are an expert SEO strategist. Group the following list of keywords into 3 to 6 logical topics or clusters (e.g., "Rooms & Suites", "Amenities", "Local Guide", "Commercial Intent", etc.).

Keywords to cluster:
${keywordsToCluster.map(k => `- ${k}`).join('\n')}

Respond ONLY with a valid JSON array of objects. Do not include any markdown formatting like \`\`\`json or explanation.
Format:
[
  { "topic": "Name of Topic", "keywords": ["keyword1", "keyword2"] },
  ...
]`;

    const aiResponse = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "SEOPulse Keyword Clustering",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://seopulse.app",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
      const errorMsg = aiData?.error?.message || aiData?.error || `OpenRouter error: ${aiResponse.status} ${aiResponse.statusText}`;
      console.error("[POST /api/websites/[id]/keywords/cluster] OpenRouter error:", aiData);
      return NextResponse.json({ error: String(errorMsg) }, { status: 502 });
    }
    const rawContent = aiData.choices?.[0]?.message?.content || "[]";
    
    // Attempt to extract JSON if the model added markdown despite instructions
    let jsonResult = rawContent;
    const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonResult = jsonMatch[0];
    }

    let clusters = [];
    try {
      clusters = JSON.parse(jsonResult);
    } catch (e) {
      console.error("Failed to parse AI cluster response:", jsonResult);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    return NextResponse.json({ clusters });
  } catch (err: any) {
    console.error("[POST /api/websites/[id]/keywords/cluster]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
