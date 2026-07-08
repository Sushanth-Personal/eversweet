import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const prompt = `
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

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
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
              { type: "text", text: prompt },
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

    if (!rawText) {
      return NextResponse.json([]);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("No valid JSON in response:", rawText);
      return NextResponse.json([]);
    }

    const items = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(items)) {
      return NextResponse.json([]);
    }

    const cleaned = items
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

    return NextResponse.json(cleaned);
  } catch (error: any) {
    console.error("extract-bill error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process bill" },
      { status: 500 },
    );
  }
}
