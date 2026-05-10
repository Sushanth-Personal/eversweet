import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { images, productList, boxList, slots } = await req.json();

    if (!images || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    const prompt = `
You are an order extraction assistant for Eversweet, a mochi dessert business.
Extract order details from these screenshot(s) of a customer conversation (DM, WhatsApp, Instagram, etc.).

Available flavours: ${productList}
Available boxes: ${boxList}

ADDRESS RULE — CRITICAL: Extract only the essential delivery location:
- Building/apartment name
- Flat / room / door number
- Nearest landmark (1 phrase max)
STRIP OUT: full street addresses, city names, pin codes, state, country, long directions.
Example input: "Flat 4B, Sunrise Apartments, near KSRTC bus stand, Thrissur, Kerala 680001"
Example output: "Flat 4B, Sunrise Apartments, near KSRTC bus stand"

SLOT RULE: Map delivery time to exactly one of: ${slots.join(", ")}

Return ONLY valid JSON (no markdown, no explanation, no backticks):
{
  "customer_name": string or null,
  "phone": string or null,
  "insta_id": string or null (without @),
  "address": string or null (essentials only),
  "delivery_date": "YYYY-MM-DD" or null,
  "delivery_slot": one of the slots above or null,
  "flavours": { "<exact flavour name from the available list>": <number> },
  "box_label": string matching a box label or null,
  "total_price": number or null,
  "remarks": string or null,
  "fulfillment_type": "delivery" or "pickup"
}
`;

    // Build Gemini parts — text prompt + all images
    const parts: object[] = [{ text: prompt }];
    for (const img of images) {
      parts.push({
        inline_data: {
          mime_type: img.mimeType,
          data: img.data,
        },
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", errText);
      return NextResponse.json(
        { error: `Gemini API error: ${response.status}` },
        { status: 500 }
      );
    }

    const geminiData = await response.json();
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    if (!rawText) {
      return NextResponse.json({ error: "Empty response from Gemini" }, { status: 500 });
    }

    // Extract JSON object from response
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("No JSON object in response:", rawText);
      return NextResponse.json({ error: "Could not parse response" }, { status: 500 });
    }

    const parsed = JSON.parse(match[0]);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("extract-order error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process screenshots" },
      { status: 500 }
    );
  }
}