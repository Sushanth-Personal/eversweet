import { NextRequest, NextResponse } from "next/server";

const TVM_CENTER = { lat: 8.5241, lng: 76.9366 };
const MAX_PLAUSIBLE_KM = 60; // reject any geocode result further than this from TVM

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isPlausible(lat: number, lng: number): boolean {
  return (
    haversineKm(TVM_CENTER.lat, TVM_CENTER.lng, lat, lng) <= MAX_PLAUSIBLE_KM
  );
}

async function geocodeNominatim(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Eversweet-Delivery/1.0 (contact@eversweet.example)",
      },
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json();
    console.log("nominatim:", query, "→", JSON.stringify(data));
    if (Array.isArray(data) && data[0]) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (isPlausible(lat, lng)) return { lat, lng };
      console.warn(
        "nominatim result rejected — too far from Trivandrum:",
        lat,
        lng,
      );
    }
    return null;
  } catch (e) {
    console.error("nominatim failed:", e);
    return null;
  }
}

async function geocodePhoton(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lat=${TVM_CENTER.lat}&lon=${TVM_CENTER.lng}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    console.log("photon:", query, "→", JSON.stringify(data));
    const coords = data?.features?.[0]?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length === 2) {
      const lat = coords[1];
      const lng = coords[0];
      if (isPlausible(lat, lng)) return { lat, lng };
      console.warn(
        "photon result rejected — too far from Trivandrum:",
        lat,
        lng,
      );
    }
    return null;
  } catch (e) {
    console.error("photon failed:", e);
    return null;
  }
}

async function geocodeText(
  fullPlace: string,
): Promise<{ lat: number; lng: number } | null> {
  const shortName = fullPlace.split(",")[0].trim();
  const shortWithCity = `${shortName}, Thiruvananthapuram, Kerala`;

  // Every query below always carries a Trivandrum anchor — never search
  // a bare street/place name with no locality, since that lets a
  // same-named place anywhere in India match by coincidence.
  return (
    (await geocodeNominatim(fullPlace)) ||
    (await geocodeNominatim(shortWithCity)) ||
    (await geocodePhoton(fullPlace)) ||
    (await geocodePhoton(shortWithCity))
  );
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    const allowed =
      /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl|maps\.google\.[a-z.]+|google\.[a-z.]+\/maps)/i;
    if (!allowed.test(url.trim())) {
      return NextResponse.json(
        { error: "Not a Google Maps link" },
        { status: 400 },
      );
    }

    const res = await fetch(url.trim(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0", Cookie: "CONSENT=YES+1" },
    });

    let finalUrl = res.url;
    if (finalUrl.includes("consent.google.com")) {
      const match = finalUrl.match(/[?&]continue=([^&]+)/);
      if (match) finalUrl = decodeURIComponent(match[1]);
    }

    console.log("resolve-maps-link finalUrl:", finalUrl);

    const coordMatch =
      finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
      finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (isPlausible(lat, lng)) {
        return NextResponse.json({ lat, lng, precise: true });
      }
      console.warn(
        "direct coord match rejected — too far from Trivandrum:",
        lat,
        lng,
      );
    }

    const qMatch = finalUrl.match(/[?&]q=([^&]+)/);
    if (qMatch) {
      const placeName = decodeURIComponent(qMatch[1].replace(/\+/g, " "));
      const geocoded = await geocodeText(placeName);
      if (geocoded) return NextResponse.json({ ...geocoded, precise: false });
    }

    return NextResponse.json(
      {
        error:
          "Couldn't confidently locate that address near Trivandrum. Please type your address manually.",
      },
      { status: 422 },
    );
  } catch (err) {
    console.error("resolve-maps-link error:", err);
    return NextResponse.json(
      { error: "Could not resolve link" },
      { status: 500 },
    );
  }
}
