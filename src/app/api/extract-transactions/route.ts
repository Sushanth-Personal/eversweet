// Location: src/app/api/extract-transactions/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const MAX_IMAGES = 5;

const PROMPT = `
You are extracting expense transactions from bank/UPI app SMS or notification
screenshots (e.g. "Rs.450.00 debited from A/c...", GPay/PhonePe/Paytm payment
notifications, credit card SMS alerts).

Rules:
- ONLY extract DEBIT transactions (money going OUT / spent / paid). Completely
  ignore credits, refunds, incoming transfers, OTPs, balance-check messages,
  promotional messages, and anything that isn't a real spend.
- IGNORE any transaction where the payee/recipient is "Kavitha Anil" or
  "Sushanth" (in any spelling/case, with or without a middle name) — these
  are internal transfers between family accounts, not real expenses, and
  must never be included.
- If the same transaction appears in more than one screenshot, only include it once.
- description: the merchant/payee name if shown, otherwise a short plain-English
  guess of what it was for based on context. Keep it short and clean.
- amount: numeric value in INR, no currency symbol or commas.
- date: use the date/time shown in the message if visible (YYYY-MM-DD). If no
  date is visible, use today's date.

Return ONLY a JSON object: {"items": [{"description":"...","amount":123,"date":"YYYY-MM-DD"}]}
If no valid debit transactions are found, return {"items": []}.
`;

const IGNORED_PAYEE_PATTERNS = [/kavitha\s*anil/i, /\bsushanth\b/i];

function cleanItems(items: any[]) {
  return items
    .filter(
      (item: any) =>
        item.description?.trim() &&
        typeof item.amount === "number" &&
        item.amount > 0,
    )
    .filter(
      (item: any) =>
        !IGNORED_PAYEE_PATTERNS.some((re) => re.test(item.description)),
    )
    .map((item: any) => ({
      description: String(item.description).trim(),
      amount: Number(item.amount),
      date:
        item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
          ? item.date
          : new Date().toISOString().split("T")[0],
    }));
}

type ImageInput = { imageBase64: string; mimeType: string };

async function tryGemini(images: ImageInput[]) {
  if (!genAI) throw new Error("Gemini not configured");
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });
  const result = await model.generateContent([
    { text: PROMPT },
    ...images.map((img) => ({
      inlineData: { data: img.imageBase64, mimeType: img.mimeType },
    })),
  ]);
  const rawText = result.response.text().trim();
  if (!rawText) throw new Error("Empty Gemini response");
  const parsed = JSON.parse(rawText);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items))
    throw new Error("Gemini returned unexpected shape");
  return items;
}

async function tryGroqScout(images: ImageInput[]) {
  if (!groq) throw new Error("Groq not configured");
  const content: any[] = [
    { type: "text", text: PROMPT },
    ...images.map((img) => ({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.imageBase64}` },
    })),
  ];
  const completion = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [{ role: "user", content }],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });
  const rawText = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!rawText) throw new Error("Empty Groq response");
  const parsed = JSON.parse(rawText);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items)) throw new Error("Groq returned unexpected shape");
  return items;
}

async function tryGroqMaverick(images: ImageInput[]) {
  if (!groq) throw new Error("Groq not configured");
  const content: any[] = [
    { type: "text", text: PROMPT },
    ...images.map((img) => ({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.imageBase64}` },
    })),
  ];
  const completion = await groq.chat.completions.create({
    model: "meta-llama/llama-4-maverick-17b-128e-instruct",
    messages: [{ role: "user", content }],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });
  const rawText = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!rawText) throw new Error("Empty Groq (Maverick) response");
  const parsed = JSON.parse(rawText);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items))
    throw new Error("Groq (Maverick) returned unexpected shape");
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
    let usedProvider = "gemini";

    try {
      items = await tryGemini(images);
    } catch (geminiErr) {
      console.warn(
        "Gemini failed, trying Groq (Scout):",
        geminiErr instanceof Error ? geminiErr.message : geminiErr,
      );
      usedProvider = "groq";
      try {
        items = await tryGroqScout(images);
      } catch (scoutErr) {
        console.warn(
          "Groq Scout failed, trying Groq (Maverick):",
          scoutErr instanceof Error ? scoutErr.message : scoutErr,
        );
        usedProvider = "groq-maverick";
        try {
          items = await tryGroqMaverick(images);
        } catch (maverickErr) {
          console.warn(
            "Groq Maverick failed, falling back to OpenAI:",
            maverickErr instanceof Error ? maverickErr.message : maverickErr,
          );
          usedProvider = "openai";
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
