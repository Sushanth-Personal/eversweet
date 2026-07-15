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

// Groq's vision models (llama-4-scout) cap out at 5 images per request.
const MAX_IMAGES = 5;

const PROMPT = `
You are a specialized accountant for "Eversweet", a mochi and pastry business.

Analyze this purchase bill/receipt image (there may be more than one image —
some bills span multiple photos, or multiple separate bills were uploaded
together. Extract line items from ALL images provided).

Your job:
1. Extract every line item from the bill(s)
2. Classify each item as either 'ingredient' or 'packaging'
3. INCLUDE: food ingredients (flour, sugar, cream, fruit, mango pulp, milk, butter, food color, flavoring, etc.), packaging materials (boxes, bags, ribbons, stickers, tape, wrappers, tissue, etc.)
4. EXCLUDE: household items (mops, brooms, cleaning supplies), personal care items, electronics, or anything unrelated to making/packaging mochi

For each item return:
- description: clean readable name of the item
- amount: numeric price in INR (just the number, no ₹ symbol)
- category: exactly "ingredient" or "packaging"
- date: use the bill date if visible, otherwise today's date in YYYY-MM-DD format

Return ONLY a JSON object with a single key "items" containing the array. No explanation.
Example: {"items": [{"description":"Mango Pulp 1kg","amount":120,"category":"ingredient","date":"2026-04-22"}]}

If the bill(s) contain no ingredient or packaging items (e.g. it's a bill for
household/cleaning supplies, electronics, or anything unrelated to mochi),
return: {"items": []}
`;

function cleanItems(items: any[]) {
  return items
    .filter(
      (item: any) =>
        item.description?.trim() &&
        typeof item.amount === "number" &&
        item.amount > 0 &&
        ["ingredient", "packaging"].includes(item.category),
    )
    .map((item: any) => ({
      description: String(item.description).trim(),
      amount: Number(item.amount),
      category: item.category,
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
    // NOTE: meta-llama/llama-4-scout-17b-16e-instruct is on Groq's
    // deprecation list. Keeping it as the first Groq attempt since it
    // still works today; tryGroqMaverick below is the safety net for
    // when Groq actually shuts it off.
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

  // Same provider/speed as Scout, still vision-capable, not on Groq's
  // deprecation list — the fallback for when Scout is retired or errors.
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

  // Final backup — uses your own OpenAI API account (separate billing from
  // a ChatGPT Plus/Team subscription; needs an OPENAI_API_KEY with credits).
  // Full gpt-4o rather than mini since this is the last line of defense.
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    });
  } catch (apiErr) {
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

    // Back-compat: accept either the old single-image shape
    // { imageBase64, mimeType } or the new multi-image shape
    // { images: [{ imageBase64, mimeType }, ...] }
    const images: ImageInput[] = Array.isArray(body.images)
      ? body.images
      : body.imageBase64
        ? [
            {
              imageBase64: body.imageBase64,
              mimeType: body.mimeType || "image/jpeg",
            },
          ]
        : [];

    if (images.length === 0) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }
    if (images.length > MAX_IMAGES) {
      return NextResponse.json(
        {
          error: `You can scan up to ${MAX_IMAGES} bills at once. Please split into smaller batches.`,
        },
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
              "extract-bill error (all providers failed):",
              openaiErr,
            );
            return NextResponse.json({ items: [], _provider: "none" });
          }
        }
      }
    }

    console.log(`extract-bill served by: ${usedProvider}`);
    return NextResponse.json({
      items: cleanItems(items),
      _provider: usedProvider,
    });
  } catch (error: any) {
    console.error("extract-bill error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process bill" },
      { status: 500 },
    );
  }
}
