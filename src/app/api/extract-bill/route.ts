import { NextResponse } from "next/server";

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

Return ONLY a valid JSON array. No explanation, no markdown, no backticks.
Example: [{"description":"Mango Pulp 1kg","amount":120,"category":"ingredient","date":"2026-04-22"}]

If no relevant items found, return: []
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", errText);
      return NextResponse.json(
        { error: `Gemini API error: ${response.status} ${errText}` },
        { status: 500 },
      );
    }

    const geminiData = await response.json();

    // Extract text from Gemini response structure
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    if (!rawText) {
      return NextResponse.json([]);
    }

    // Robustly extract JSON array
    const match = rawText.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error("No JSON array in response:", rawText);
      return NextResponse.json([]);
    }

    const parsed = JSON.parse(match[0]);

    // Sanitize
    const cleaned = parsed
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
