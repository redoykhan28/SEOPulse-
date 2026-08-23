import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Ordered list of free models to try. If one is retired, the next is used automatically.
const FREE_MODELS = [
  "google/gemma-2-9b-it:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free",
];

async function callOpenRouter(prompt: string, temperature = 0.7): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY!;
  const referer = process.env.NEXT_PUBLIC_SITE_URL || "https://seopulse.app";

  // If user has explicitly set a model, use it directly (no fallback)
  const explicitModel = process.env.OPENROUTER_MODEL;
  const modelsToTry = explicitModel ? [explicitModel] : FREE_MODELS;

  let lastError = "";

  for (const model of modelsToTry) {
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "SEOPulse",
        "HTTP-Referer": referer,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || data?.error || `${res.status} ${res.statusText}`;
      console.warn(`[OpenRouter] Model ${model} failed: ${msg}`);
      lastError = String(msg);

      // If it's a "no endpoints" or "unavailable" error, try the next model
      if (
        res.status === 404 ||
        String(msg).toLowerCase().includes("no endpoints") ||
        String(msg).toLowerCase().includes("unavailable")
      ) {
        continue;
      }

      // Any other error (auth, rate limit, etc.) — stop immediately
      throw new Error(String(msg));
    }

    const content = data.choices?.[0]?.message?.content || "";
    if (!content) {
      lastError = "AI returned an empty response.";
      continue;
    }

    console.log(`[OpenRouter] Successfully used model: ${model}`);
    return content;
  }

  throw new Error(`All AI models unavailable. Last error: ${lastError}`);
}

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
      return NextResponse.json({ error: "OpenRouter API key is missing. Add OPENROUTER_API_KEY to your environment variables." }, { status: 500 });
    }

    const prompt = `You are an expert SEO content strategist. Create a comprehensive content brief for the keyword: "${keyword}".

Please format your response in clear Markdown with the following sections:
1. **Suggested URL Slug**: A clean, SEO-friendly slug.
2. **Title & Meta Description**: Optimized for high CTR.
3. **Target Audience & Intent**: Briefly explain who is searching for this and why (informational, commercial, etc.).
4. **Content Outline**: A structured outline using H2s and H3s.
5. **LSI / Secondary Keywords**: 10 related keywords to naturally include in the content.

Do not include any pleasantries or conversational text before or after the brief. Just output the Markdown.`;

    const brief = await callOpenRouter(prompt, 0.7);
    return NextResponse.json({ brief });
  } catch (err: any) {
    console.error("[POST /api/websites/[id]/keywords/brief]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 502 });
  }
}
