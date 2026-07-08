import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const prompt = `You are an order extraction assistant for Eversweet, a mochi dessert business.
Extract order details from these screenshot(s) of a customer conversation (DM, WhatsApp, Instagram, etc.).

Today's date is ${today}. Use this to resolve relative dates like "tomorrow", "day after tomorrow".

FLAVOUR LIST (return the NUMBER, not the name):
${numberedFlavours}

BOX PRICES for reference only (do NOT return box info — just extract total_price as a number):
${boxPriceList}

FLAVOUR RULE: Return flavour numbers and quantities as { "1": 2, "3": 1 } using the numbers above.
If customer says qty like "Box of 4" with flavour names, each flavour gets 1 unless stated otherwise.

ADDRESS RULE: Extract only essentials — building name, flat/room number, one nearby landmark. Strip city, pin code, state, long directions.
Example in: "Vaimpillil house, TTRA-116, Pallath lane, LBS Road, Thiruvamkulam-682305"
Example out: "Vaimpillil house, TTRA-116, near Pallath lane"

SLOT RULE: Map to one of: ${slots.join(", ")}
evening=5-7 PM, morning=9-11 AM, afternoon=1-3 PM, night=7-9 PM

Return ONLY raw JSON matching this exact shape, no other text:
{"customer_name":null,"phone":null,"insta_id":null,"address":null,"delivery_date":null,"delivery_slot":null,"flavours":{},"total_price":null,"remarks":null,"fulfillment_type":"delivery"}`;

    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: prompt },
      ...images.map((img: { mimeType: string; data: string }) => ({
        type: "image_url" as const,
        image_url: { url: `data:${img.mimeType};base64,${img.data}` },
      })),
    ];

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content }],
        temperature: 0.1,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      });
    } catch (apiErr) {
      // one retry on transient failure (rate limit / 5xx)
      await new Promise((r) => setTimeout(r, 1200));
      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content }],
        temperature: 0.1,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      });
    }

    const rawText = completion.choices[0]?.message?.content?.trim() ?? "";
    console.log("=== extract-order OpenAI raw ===\n", rawText, "\n===");

    if (!rawText) {
      return NextResponse.json(
        { error: "Empty response from OpenAI" },
        { status: 500 },
      );
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {}
      }
    }

    if (!parsed) {
      console.error("Could not parse JSON. Raw:", rawText);
      return NextResponse.json(
        { error: "AI returned unreadable response. Check server logs." },
        { status: 500 },
      );
    }

    // Map flavour numbers → product IDs
    const matchedFlavours: Record<string, number> = {};
    if (parsed.flavours && typeof parsed.flavours === "object") {
      for (const [numStr, qty] of Object.entries(parsed.flavours)) {
        const idx = parseInt(numStr, 10) - 1;
        if (idx >= 0 && idx < productArr.length) {
          matchedFlavours[productArr[idx].id] = Number(qty);
        }
      }
    }

    // Match total_price → box
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
    });
  } catch (error: any) {
    console.error("extract-order error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process screenshots" },
      { status: 500 },
    );
  }
}
