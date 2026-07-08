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

const PROMPT = `
You are a specialized accountant for "Eversweet", a mochi and pastry business.

Analyze this purchase bill/receipt image carefully.

Your job:
1. Extract every line item from the bill
2. Classify each item as either 'ingredient' or 'packaging'
3. INCLUDE: food ingredients (flour, sugar, cream, fruit, mango pulp, milk, butter, food color, flavoring, etc.), packaging materials (boxes, bags, ribbons, stickers, tape, wrappers, tissue, etc.)
4. EXCLUDE: household items, personal care items, electronics, unrelated purchases

For each item return:
- description: clean readable name of the item
- amount: numeric price in INR (just the number, no ₹ symbol)
- category: exactly "ingredient" or "packaging"
- date: use the bill date if visible, otherwise today's date in YYYY-MM-DD format

Return ONLY a JSON object with a single key "items" containing the array. No explanation.
Example: {"items": [{"description":"Mango Pulp 1kg","amount":120,"category":"ingredient","date":"2026-04-22"}]}

If no relevant items found, return: {"items": []}
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

async function tryGemini(imageBase64: string, mimeType: string) {
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
    { inlineData: { data: imageBase64, mimeType } },
  ]);

  const rawText = result.response.text().trim();
  if (!rawText) throw new Error("Empty Gemini response");

  const parsed = JSON.parse(rawText);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items))
    throw new Error("Gemini returned unexpected shape");

  return items;
}

async function tryGroq(imageBase64: string, mimeType: string) {
  if (!groq) throw new Error("Groq not configured");

  const completion = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
        ],
      },
    ],
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

async function tryOpenAI(imageBase64: string, mimeType: string) {
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    });
  } catch (apiErr) {
    await new Promise((r) => setTimeout(r, 1200));
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
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
    const { imageBase64, mimeType = "image/jpeg" } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    let items: any[] = [];
    let usedProvider = "gemini";

    try {
      items = await tryGemini(imageBase64, mimeType);
    } catch (geminiErr) {
      console.warn(
        "Gemini failed, trying Groq:",
        geminiErr instanceof Error ? geminiErr.message : geminiErr,
      );
      usedProvider = "groq";
      try {
        items = await tryGroq(imageBase64, mimeType);
      } catch (groqErr) {
        console.warn(
          "Groq failed, falling back to OpenAI:",
          groqErr instanceof Error ? groqErr.message : groqErr,
        );
        usedProvider = "openai";
        try {
          items = await tryOpenAI(imageBase64, mimeType);
        } catch (openaiErr) {
          console.error(
            "extract-bill error (all providers failed):",
            openaiErr,
          );
          return NextResponse.json({ items: [], _provider: "none" });
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
