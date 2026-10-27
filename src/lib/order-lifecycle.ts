export const LINK_LIFETIME_MS = 5 * 60 * 1000;
export const normalizedStatus = (o: {status?: string | null}) => (o.status || "pending").trim().toLowerCase();
export function linkExpiresAt(o: {created_at?: string; notes?: string | null}) {
  const saved = o.notes?.match(/Order link expires at:\s*([^|]+)/)?.[1]?.trim();
  // Supabase's legacy created_at is timestamp-without-time-zone, stored in UTC.
  const created = o.created_at ? Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(o.created_at) ? o.created_at : o.created_at + "Z") : NaN;
  return saved ? Date.parse(saved) : created + LINK_LIFETIME_MS;
}
export function isExpiredLink(o: {status?:string|null;created_at?:string;notes?:string|null}, now=Date.now()) {
  return normalizedStatus(o) === "expired" || (normalizedStatus(o) === "draft" && (!Number.isFinite(linkExpiresAt(o)) || linkExpiresAt(o) <= now));
}
export function isRealOrder(o: {status?:string|null}) {
  return !["draft","expired","cancelled","deleted","archived"].includes(normalizedStatus(o));
}
export function isActiveOrder(o: {status?:string|null}) {
  return isRealOrder(o) && !["dispatched","completed","delivered"].includes(normalizedStatus(o));
}
export const EXPIRED_LINK_MESSAGE = "This order link has expired. Please request a new order link.";
