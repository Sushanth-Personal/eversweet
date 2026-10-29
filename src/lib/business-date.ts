/** Canonical reservation/delivery DATE. Never fall back to created_at/order_date. */
export function deliveryDateOf(order: { delivery_date?: string | null }) {
  const value = order.delivery_date || "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}
export const indiaToday = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
}).format(new Date());

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function monthLength(year: number, month: number) {
  return month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
}
function weekday(year: number, month: number, day: number) {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  if (month < 3) year--;
  return (year + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400) + offsets[month - 1] + day) % 7;
}
export function businessDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return `${weekdays[weekday(year, month, day)]}, ${day} ${months[month - 1]?.slice(0, 3)}`;
}
export function calendarMonth(month: string) {
  const [year, number] = month.split("-").map(Number);
  return {
    label: `${months[number - 1]} ${year}`,
    leading: weekday(year, number, 1),
    days: Array.from({ length: monthLength(year, number) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  };
}
export function shiftBusinessMonth(month: string, delta: number) {
  const [year, number] = month.split("-").map(Number);
  const index = year * 12 + number - 1 + delta;
  return `${Math.floor(index / 12)}-${String(((index % 12) + 12) % 12 + 1).padStart(2, "0")}`;
}
export function orderCity(order: { source?: string | null }) {
  const source = order.source?.trim().toLowerCase();
  return source === "trivandrum" ? "trivandrum" : source === "kozhikode" ? "kozhikode" : "kochi";
}
export function ordersOnDate<T extends { delivery_date?: string | null; source?: string | null; status: string }>(orders: T[], date: string, city = "all") {
  return orders.filter(order => order.status.trim().toLowerCase() !== "cancelled" && deliveryDateOf(order) === date && (city === "all" || orderCity(order) === city));
}
