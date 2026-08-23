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
    const { keyword } = body as { keyword: string };

    if (!keyword) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "OpenRouter API key is missing" }, { status: 500 });
    }

    const prompt = `You are an expert SEO content strategist. Create a comprehensive content brief for the keyword: "${keyword}".

Please format your response in clear Markdown with the following sections:
1. **Suggested URL Slug**: A clean, SEO-friendly slug.
2. **Title & Meta Description**: Optimized for high CTR.
3. **Target Audience & Intent**: Briefly explain who is searching for this and why (informational, commercial, etc.).
4. **Content Outline**: A structured outline using H2s and H3s.
5. **LSI / Secondary Keywords**: 10 related keywords to naturally include in the content.

Do not include any pleasantries or conversational text before or after the brief. Just output the Markdown.`;

    const aiResponse = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "SEOPulse Content Brief",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`OpenRouter API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const brief = aiData.choices?.[0]?.message?.content || "";

    return NextResponse.json({ brief });
  } catch (err) {
    console.error("[POST /api/websites/[id]/keywords/brief]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
