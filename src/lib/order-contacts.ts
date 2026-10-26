import { googleMapsLink } from "./maps-plus-code";
export type ContactField = "phone" | "instagram" | "map";
export function instagramUrl(value?: string | null) {
  const input = (value || "").trim();
  if (!input) return "";
  const username = input.replace(/^@/, "");
  if (/^[\w.]{1,30}$/.test(username))
    return `https://www.instagram.com/${username}/`;
  try {
    const url = new URL(/^https?:/.test(input) ? input : `https://${input}`);
    if (!["instagram.com", "www.instagram.com"].includes(url.hostname))
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
        ? instagramUrl(values.insta_id)
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
