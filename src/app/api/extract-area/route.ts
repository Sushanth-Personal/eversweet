// Location: src/app/api/extract-area/route.ts
import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

// Fast, offline, zero-cost first pass — a curated list of common
// Trivandrum localities. Longest names are checked first so
// "East Fort" wins over a bare "Fort" match, etc.
const KNOWN_AREAS = [
  "East Fort",
  "Peroorkada",
  "Pattom",
  "Kesavadasapuram",
  "Sasthamangalam",
  "Kowdiar",
  "Vazhuthacaud",
  "Thampanoor",
  "Vellayambalam",
  "Kumarapuram",
  "Medical College",
  "Chackai",
  "Karamana",
  "Nalanchira",
  "Sreekaryam",
  "Kazhakootam",
  "Technopark",
  "Attukal",
  "Manacaud",
  "Poojappura",
  "Kaimanam",
  "Vattiyoorkavu",
  "Muttada",
  "Pongumoodu",
  "Ulloor",
  "Palayam",
  "Statue",
  "Chalai",
  "Pettah",
  "Killipalam",
  "Thiruvallam",
  "Kovalam",
  "Vizhinjam",
  "Balaramapuram",
  "Nedumangad",
  "Kattakada",
  "Neyyattinkara",
  "PMG",
];

export function guessAreaHeuristic(address: string): string {
  if (!address) return "";
  const lower = address.toLowerCase();
  for (const area of KNOWN_AREAS) {
    if (lower.includes(area.toLowerCase())) return area;
  }
  return "";
}

export async function POST(req: Request) {
  try {
    const { addresses } = (await req.json()) as { addresses: string[] };
    if (!Array.isArray(addresses)) {
      return NextResponse.json({ error: "Expected addresses[]" }, { status: 400 });
    }

    // Only ask the AI about addresses the heuristic couldn't confidently tag —
    // saves calls and keeps this fast.
    const heuristics = addresses.map(guessAreaHeuristic);
    const needsAi = addresses
      .map((a, i) => ({ a, i }))
      .filter(({ a, i }) => a && !heuristics[i]);

    const areas = [...heuristics];

    if (needsAi.length > 0 && groq) {
      try {
        const list = needsAi
          .map(({ a, i }) => `${i}: ${a}`)
          .join("\n");
        const completion = await groq.chat.completions.create({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "user",
              content: `These are delivery addresses in and around Thiruvananthapuram (Trivandrum), Kerala. For each numbered address, return the single most recognisable locality/area name (e.g. Peroorkada, Pattom, Sreekaryam, Kowdiar). Keep it short — just the area name, no "near" or extra words. If you can't tell, use "".

${list}

Return ONLY a JSON object like {"0":"Peroorkada","1":""} — keys are the numbers above.`,
            },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        });
        const raw = completion.choices[0]?.message?.content?.trim() || "{}";
        const parsed = JSON.parse(raw);
        for (const { i } of needsAi) {
          const val = parsed[String(i)];
          if (val && typeof val === "string") areas[i] = val.trim();
        }
      } catch (e) {
        console.warn("extract-area: Groq call failed, using heuristic only", e);
      }
    }

    return NextResponse.json({ areas });
  } catch (err) {
    console.error("extract-area error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}