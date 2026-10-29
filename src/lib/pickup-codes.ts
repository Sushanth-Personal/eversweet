export const PICKUP_CITIES = [
  { id: "trivandrum", label: "TVM", name: "Trivandrum", code: "FXQ2+35X Thiruvananthapuram, Keralam" },
  { id: "kochi", label: "Kochi", name: "Kochi", code: "7J2R28VM+3X" },
  { id: "kozhikode", label: "Kozhikode", name: "Kozhikode", code: "" },
] as const;
export type PickupCodes = Record<string, string>;
export const DEFAULT_PICKUP_CODES: PickupCodes = Object.fromEntries(PICKUP_CITIES.map(c => [c.id, c.code]));
export function validPickupCode(code: unknown): code is string {
  return typeof code === "string" && code.length <= 200 && (code === "" || /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3}(?:[ ,].*)?$/i.test(code));
}
