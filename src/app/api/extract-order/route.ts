// Location: src/app/api/extract-order/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import Groq from "groq-sdk";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

// Groq retired llama-4-scout and llama-4-maverick (Feb 2026). Their current
// vision-capable model is qwen/qwen3.6-27b — served as "preview", so it can
// still be unstable; OpenAI remains the safety net below.
const GROQ_VISION_MODEL = "qwen/qwen3.6-27b";

function buildPrompt(
  today: string,
  numberedFlavours: string,
  boxPriceList: string,
  slots: string[],
) {
  return `You are an order extraction assistant for Eversweet, a mochi dessert business.
Extract order details from these screenshot(s) of a customer conversation (DM, WhatsApp, Instagram, etc.).

Today's date is ${today}. Use this to resolve relative dates like "tomorrow", "day after tomorrow".

FLAVOUR LIST (return the NUMBER, not the name):
${numberedFlavours}

BOX PRICES for reference only (do NOT return box info — just extract total_price as a number):
${boxPriceList}

FLAVOUR RULE: Return flavour numbers and quantities as { "1": 2, "3": 1 } using the numbers above.
If customer says qty like "Box of 4" with flavour names, each flavour gets 1 unless stated otherwise.

DELIVERY CHARGE RULE: If the conversation separately mentions a delivery
fee/charge (e.g. "+50 delivery", "delivery charge 100", "50 for delivery"),
extract that as delivery_charge — a plain number, NOT included again in
total_price (total_price should be the full amount including delivery, and
delivery_charge should be just the delivery portion of it). If no delivery
charge is mentioned at all, return delivery_charge as null — do NOT guess
or assume a delivery charge exists just because it's a delivery order.

ADDRESS RULE: Extract only essentials — building name, flat/room number, one nearby landmark. Strip city, pin code, state, long directions.
Example in: "Vaimpillil house, TTRA-116, Pallath lane, LBS Road, Thiruvamkulam-682305"
Example out: "Vaimpillil house, TTRA-116, near Pallath lane"

SLOT RULE: Map to one of: ${slots.join(", ")}
evening=5-7 PM, morning=9-11 AM, afternoon=1-3 PM, night=7-9 PM

Return ONLY a JSON object matching this exact shape, no other text:
{"customer_name":null,"phone":null,"insta_id":null,"address":null,"delivery_date":null,"delivery_slot":null,"flavours":{},"total_price":null,"delivery_charge":null,"remarks":null,"fulfillment_type":"delivery"}`;
}

function parseExtracted(rawText: string): any {
  if (!rawText) throw new Error("Empty response");
  try {
    return JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not parse JSON response");
  }
}

async function tryGroq(
  prompt: string,
  images: { mimeType: string; data: string }[],
) {
  if (!groq) throw new Error("Groq not configured");

  const content: any[] = [{ type: "text", text: prompt }];
  for (const img of images) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` },
    });
  }

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
  return parseExtracted(rawText);
}

async function tryOpenAI(
  prompt: string,
  images: { mimeType: string; data: string }[],
) {
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: prompt },
    ...images.map((img) => ({
      type: "image_url" as const,
      image_url: { url: `data:${img.mimeType};base64,${img.data}` },
    })),
  ];

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });
  } catch (apiErr) {
    await new Promise((r) => setTimeout(r, 1200));
    completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });
  }

  const rawText = completion.choices[0]?.message?.content?.trim() ?? "";
  return parseExtracted(rawText);
}

export async function POST(req: Request) {
  try {
    const { images, slots, products, boxes } = await req.json();

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 },
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const productArr = products as { id: string; name: string }[];
    const boxArr = boxes as { id: string; label: string; price: number }[];

    const numberedFlavours = productArr
      .map((p, i) => `${i + 1}. ${p.name}`)
      .join("\n");
    const boxPriceList = boxArr
      .map((b) => `₹${b.price} = ${b.label}`)
      .join(", ");
    const prompt = buildPrompt(today, numberedFlavours, boxPriceList, slots);

    let parsed: any = null;
    let usedProvider = "groq";

    try {
      parsed = await tryGroq(prompt, images);
    } catch (groqErr) {
      console.warn(
        "Groq failed, falling back to ChatGPT:",
        groqErr instanceof Error ? groqErr.message : groqErr,
      );
      usedProvider = "chatgpt";
      try {
        parsed = await tryOpenAI(prompt, images);
      } catch (openaiErr) {
        console.error("extract-order error (all providers failed):", openaiErr);
        return NextResponse.json(
          { error: "AI providers failed. Check server logs." },
          { status: 500 },
        );
      }
    }

    console.log(`extract-order served by: ${usedProvider}`);

    if (!parsed) {
      return NextResponse.json(
        { error: "AI returned unreadable response. Check server logs." },
        { status: 500 },
      );
    }

    const matchedFlavours: Record<string, number> = {};
    if (parsed.flavours && typeof parsed.flavours === "object") {
      for (const [numStr, qty] of Object.entries(parsed.flavours)) {
        const idx = parseInt(numStr, 10) - 1;
        if (idx >= 0 && idx < productArr.length) {
          matchedFlavours[productArr[idx].id] = Number(qty);
        }
      }
    }

    let box_size_id: string | null = null;
    let box_label: string | null = null;
    if (parsed.total_price) {
      const price = Number(parsed.total_price);
      const matchedBox = boxArr.find((b) => b.price === price);
      if (matchedBox) {
        box_size_id = matchedBox.id;
        box_label = matchedBox.label;
      }
    }

    return NextResponse.json({
      ...parsed,
      flavours: matchedFlavours,
      box_size_id,
      box_label,
      _provider: usedProvider,
    });
  } catch (error: any) {
    console.error("extract-order error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process screenshots" },
      { status: 500 },
    );
  }
}
