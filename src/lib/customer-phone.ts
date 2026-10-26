/** Accept a ten-digit Indian number, with optional +91 and visual separators. */
export function customerPhone(value: string) {
  let digits = value.trim().replace(/[\s()-]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  return /^\d{10}$/.test(digits) ? digits : "";
}
