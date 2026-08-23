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

async function callOpenRouter(prompt: string, temperature = 0.1): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY!;
  const referer = process.env.NEXT_PUBLIC_SITE_URL || "https://seopulse.app";

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

      if (
        res.status === 404 ||
        String(msg).toLowerCase().includes("no endpoints") ||
        String(msg).toLowerCase().includes("unavailable")
      ) {
        continue;
      }

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
    const { keywords } = body as { keywords: string[] };

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "Keywords array is required" }, { status: 400 });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "OpenRouter API key is missing." }, { status: 500 });
    }

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

    const rawContent = await callOpenRouter(prompt, 0.1);

    // Extract JSON even if model wraps it in markdown
    let jsonResult = rawContent;
    const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) jsonResult = jsonMatch[0];

    let clusters = [];
    try {
      clusters = JSON.parse(jsonResult);
    } catch (e) {
      console.error("Failed to parse AI cluster response:", jsonResult);
      return NextResponse.json({ error: "AI returned an unexpected format. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ clusters });
  } catch (err: any) {
    console.error("[POST /api/websites/[id]/keywords/cluster]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 502 });
  }
}
