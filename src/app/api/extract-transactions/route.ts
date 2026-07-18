// Location: src/app/api/extract-transactions/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import Groq from "groq-sdk";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const MAX_IMAGES = 5;

// Groq retired llama-4-scout and llama-4-maverick (Feb 2026). Their current
// vision-capable model is qwen/qwen3.6-27b — served as "preview", so it can
// still be unstable; OpenAI remains the safety net below.
const GROQ_VISION_MODEL = "qwen/qwen3.6-27b";

const PROMPT = `
You are extracting expense transactions from bank/UPI app SMS or notification
screenshots (e.g. "Rs.450.00 debited from A/c...", GPay/PhonePe/Paytm payment
notifications, credit card SMS alerts).

Today's date is ${new Date().toISOString().split("T")[0]}.

IMPORTANT — date format warning: Indian bank SMS often show dates as
DD-Mon-YY with a 2-DIGIT year, e.g. "17-Jul-26". That "26" means the YEAR
2026, NOT 2024 and NOT day 26. Convert 2-digit years by prefixing "20" —
so "26" → 2026, "25" → 2025, etc. Do NOT guess or default to an older year;
read the exact digits shown and prefix them with "20".

Rules:
- ONLY extract DEBIT transactions (money going OUT / spent / paid). Completely
  ignore credits, refunds, incoming transfers, OTPs, balance-check messages,
  promotional messages, and anything that isn't a real spend.
- If the same transaction appears in more than one screenshot, only include it once.
- description: the merchant/payee name if shown, otherwise a short plain-English
  guess of what it was for based on context. Keep it short and clean.
- amount: numeric value in INR, no currency symbol or commas.
- date: YYYY-MM-DD. Read the exact date shown in the message (see the 2-digit
  year warning above). If no date is visible at all anywhere in the message,
  use today's date exactly.

Return ONLY a JSON object: {"items": [{"description":"...","amount":123,"date":"YYYY-MM-DD"}]}
If no valid debit transactions are found, return {"items": []}.
`;

function sanitizeDate(raw: string | undefined): string {
  const today = new Date().toISOString().split("T")[0];
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return today;
  const year = Number(raw.slice(0, 4));
  const currentYear = new Date().getFullYear();
  if (Math.abs(year - currentYear) > 1) return today;
  return raw;
}

function cleanItems(items: any[]) {
  return items
    .filter(
      (item: any) =>
        item.description?.trim() &&
        typeof item.amount === "number" &&
        item.amount > 0,
    )
    .map((item: any) => ({
      description: String(item.description).trim(),
      amount: Number(item.amount),
      date: sanitizeDate(item.date),
    }));
}

type ImageInput = { imageBase64: string; mimeType: string };

async function tryGroq(images: ImageInput[]) {
  if (!groq) throw new Error("Groq not configured");
  const content: any[] = [
    { type: "text", text: PROMPT },
    ...images.map((img) => ({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.imageBase64}` },
    })),
  ];
  const completion = await groq.chat.completions.create({
    model: GROQ_VISION_MODEL,
    messages: [{ role: "user", content }],
    temperature: 0.1,
    max_completion_tokens: 4096,
    reasoning_effort: "none",
    reasoning_format: "hidden",
    response_format: { type: "json_object" },
  });
  const rawText = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!rawText) throw new Error("Empty Groq response");
  const parsed = JSON.parse(rawText);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items)) throw new Error("Groq returned unexpected shape");
  return items;
}

async function tryOpenAI(images: ImageInput[]) {
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: PROMPT },
    ...images.map((img) => ({
      type: "image_url" as const,
      image_url: { url: `data:${img.mimeType};base64,${img.imageBase64}` },
    })),
  ];
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    });
  } catch {
    await new Promise((r) => setTimeout(r, 1200));
    completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    });
  }
  const rawText = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!rawText) return [];
  const parsed = JSON.parse(rawText);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  return Array.isArray(items) ? items : [];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const images: ImageInput[] = Array.isArray(body.images) ? body.images : [];

    if (images.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 },
      );
    }
    if (images.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Up to ${MAX_IMAGES} screenshots at once, please.` },
        { status: 400 },
      );
    }

    let items: any[] = [];
    let usedProvider = "groq";

    try {
      items = await tryGroq(images);
    } catch (groqErr) {
      console.warn(
        "Groq failed, falling back to ChatGPT:",
        groqErr instanceof Error ? groqErr.message : groqErr,
      );
      usedProvider = "chatgpt";
      try {
        items = await tryOpenAI(images);
      } catch (openaiErr) {
        console.error(
          "extract-transactions error (all providers failed):",
          openaiErr,
        );
        return NextResponse.json({ items: [], _provider: "none" });
      }
    }

    return NextResponse.json({
      items: cleanItems(items),
      _provider: usedProvider,
    });
  } catch (error: any) {
    console.error("extract-transactions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process screenshots" },
      { status: 500 },
    );
  }
}
