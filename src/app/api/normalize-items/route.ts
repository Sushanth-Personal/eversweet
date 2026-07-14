// src/app/api/normalize-items/route.ts
import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

// Groups item descriptions that refer to the same underlying product,
// even if wording/brand/spelling differs across bills.
export async function POST(req: Request) {
  try {
    const { items } = (await req.json()) as { items: string[] };
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ groups: {} });
    }

    const unique = Array.from(
      new Set(items.map((s) => s.trim()).filter(Boolean)),
    );
    if (unique.length <= 1 || !groq) {
      // Nothing to cluster, or no AI available — identity mapping
      const groups: Record<string, string> = {};
      unique.forEach((u) => (groups[u] = u));
      return NextResponse.json({ groups });
    }

    const list = unique.map((u, i) => `${i}: ${u}`).join("\n");
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content: `These are ingredient/packaging line items from purchase bills for a mochi (Japanese dessert) business. Some entries refer to the SAME underlying product but are worded differently (different brand names, spelling, units, abbreviations, etc — e.g. "Mango Mallika", "Mango pulp Mallika 1kg", "Mallika Mango" are the same item).

Group these into canonical product groups. For each numbered item, assign a short canonical name (use the most common/clean version, no units or quantities).

${list}

Return ONLY a JSON object mapping each number to its canonical name, e.g. {"0":"Mango Mallika Pulp","1":"Paper Carry Bag (Mini)"}. Every number must appear.`,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    const parsed = JSON.parse(raw);
    const groups: Record<string, string> = {};
    unique.forEach((u, i) => {
      const canon = parsed[String(i)];
      groups[u] = typeof canon === "string" && canon.trim() ? canon.trim() : u;
    });

    return NextResponse.json({ groups });
  } catch (err) {
    console.error("normalize-items error:", err);
    // fail-safe: identity mapping so the panel still works
    const { items } = await req.json().catch(() => ({ items: [] as string[] }));
    const groups: Record<string, string> = {};
    (items || []).forEach((u: string) => (groups[u] = u));
    return NextResponse.json({ groups });
  }
}
