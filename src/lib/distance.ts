const THAMPANOOR = { lat: 8.4868746, lng: 76.9528824 };
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

// Road distance via OSRM (free, no key). Falls back to Haversine*1.4 if it fails.
export async function getRoadDistanceKm(lat: number, lng: number): Promise<number> {
  console.log("getRoadDistanceKm called with:", { lat, lng, THAMPANOOR });
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${THAMPANOOR.lng},${THAMPANOOR.lat};${lng},${lat}?overview=false`;
    console.log("OSRM url:", url);
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    console.log("OSRM response:", JSON.stringify(data).slice(0, 500));
    const meters = data?.routes?.[0]?.distance;
    if (typeof meters === "number" && meters > 0) return meters / 1000;
    throw new Error("no route");
  } catch (e) {
    console.error("OSRM failed, using haversine fallback:", e);
    const fallback = haversineKm(THAMPANOOR.lat, THAMPANOOR.lng, lat, lng) * 1.4;
    console.log("haversine fallback result:", fallback);
    return fallback;
  }
}

// Same formula already used in /admin/delivery — kept identical for consistency.
export function deliveryCharge(distanceKm: number): number {
  if (!distanceKm || distanceKm <= 0) return 0;
  return Math.floor(50 + 9 * distanceKm);
}

export async function getUserLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

export function parseLatLngFromMapsUrl(
  url: string,
): { lat: number; lng: number } | null {
  const decoded = decodeURIComponent(url);
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
  ];
  for (const re of patterns) {
    const m = decoded.match(re);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  return null;
}

export function parseLatLngFromRawText(
  text: string,
): { lat: number; lng: number } | null {
  const m = text.trim().match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
}

export async function resolveLocationInput(
  input: string,
): Promise<{ lat: number; lng: number }> {
  const raw = parseLatLngFromRawText(input);
  if (raw) return raw;

  const direct = parseLatLngFromMapsUrl(input);
  if (direct) return direct;

  const res = await fetch("/api/resolve-maps-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: input.trim() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not read that link");
  if (typeof data.lat !== "number" || typeof data.lng !== "number") {
    throw new Error("Couldn't find a location in that link");
  }
  return { lat: data.lat, lng: data.lng };
}
