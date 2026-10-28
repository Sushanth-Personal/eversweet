import { googleMapsLink } from "./maps-plus-code";
export type ContactField = "phone" | "instagram" | "map" | "flavours" | "time";
/** Convert profile links at opening time only; stored profile values stay unchanged. */
export function getInstagramDmUrl(profileUrl?: string | null) {
  if (!profileUrl?.trim()) return "";
  try {
    const url = new URL(profileUrl.trim());
    if (!['https:', 'http:'].includes(url.protocol) ||
        !['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname.toLowerCase()) ||
        url.username || url.password || url.port) return "";
    const match = url.pathname.match(/^\/([A-Za-z0-9_.]{1,30})\/?$/);
    const username = match?.[1];
    if (!username || ['p', 'reel', 'reels', 'stories', 'explore', 'direct', 'accounts', 'about', 'developer', 'legal'].includes(username.toLowerCase())) return "";
    return `https://ig.me/m/${username}`;
  } catch {
    return "";
  }
}
export function instagramUrl(value?: string | null) {
  const raw = (value || "").trim();
  // Sharing/copying can include a Markdown wrapper or surrounding message.
  const input = raw.match(/https?:\/\/(?:www\.|m\.)?instagram\.com\/[^\s<>\])]+/i)?.[0] || raw;
  if (!input) return "";
  const username = input.replace(/^@/, "");
  if (/^[\w.]{1,30}$/.test(username))
    return `https://www.instagram.com/${username}/`;
  try {
    const url = new URL(/^https?:/.test(input) ? input : `https://${input}`);
    if (!["instagram.com", "www.instagram.com", "m.instagram.com"].includes(url.hostname.toLowerCase()))
      return "";
    const name = url.pathname.split("/").filter(Boolean)[0];
    return name && /^[\w.]{1,30}$/.test(name)
      ? `https://www.instagram.com/${name}/`
      : "";
  } catch {
    return "";
  }
}
export function contactAction(
  field: ContactField,
  values: { phone?: string; insta_id?: string; customer_maps_url?: string },
) {
  const value =
    field === "phone"
      ? values.phone?.replace(/[^\d+]/g, "")
      : field === "instagram"
        ? getInstagramDmUrl(values.insta_id)
        : googleMapsLink(values.customer_maps_url || "");
  return value
    ? { href: field === "phone" ? `tel:${value}` : value, focus: null }
    : { href: null, focus: field };
}
export function deliveryText(values: {
  customer_name?: string;
  phone?: string;
  address?: string | null;
  customer_maps_url?: string;
}) {
  return [
    values.customer_name || "",
    values.phone || "",
    values.address || "",
    values.customer_maps_url || "",
  ].join("\n");
}
