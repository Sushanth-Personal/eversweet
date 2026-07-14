import type { Order } from "@/lib/types";

export type Tab =
  | "cook"
  | "pending_payment"
  | "orders"
  | "customers"
  | "dashboard"
  | "more"
  | "trivandrum";

export type OrdersFilterPreset = "today_paid" | "period_paid" | null;
export type MoreTab = "products" | "boxes";

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  note?: string;
  item_key: string | null;
  created_at: string;
};

export type ExtOrder = Order & {
  insta_id?: string;
  remarks?: string;
  source?: string;
  order_date?: string;
  delivery_date?: string;
  delivery_slot?: string;
  batch_label?: string;
  fulfillment_type?: string;
  payment_confirmed_at?: string;
};

export const TRACKING_START_DATE = "2026-04-21";

export const ALL_SLOTS = [
  "9–11 AM",
  "11–1 PM",
  "1–3 PM",
  "3–5 PM",
  "5–7 PM",
  "7–9 PM",
  "9–11 PM",
  "11 PM–12 AM",
];

export const STATUS_FLOW = [
  "pending",
  "confirmed",
  "cooking",
  "cooked",
  "porter_booked",
  "dispatched",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: "Payment Pending",
  confirmed: "Confirmed",
  cooking: "Cooking",
  cooked: "Cooked ✓",
  porter_booked: "Porter Booked",
  dispatched: "Dispatched",
  cancelled: "Cancelled",
};

export const PAID_STATUSES = [
  "confirmed",
  "cooking",
  "cooked",
  "porter_booked",
  "dispatched",
];

export const CATEGORY_CONFIG: Record<string, { label: string; icon: string }> =
  {
    ingredient: { label: "Ingredients", icon: "🧪" },
    packaging: { label: "Packaging", icon: "📦" },
    equipment: { label: "Equipment", icon: "🔧" },
    delivery: { label: "Delivery", icon: "🚚" },
    fixed: { label: "Fixed Cost", icon: "🏠" },
    marketing: { label: "Marketing", icon: "📣" },
    other: { label: "Other", icon: "📋" },
  };

export const BATCHES = [
  { label: "Morning", range: "6 AM – 12 PM", slots: ["9–11 AM"] },
  {
    label: "Afternoon",
    range: "12 PM – 4 PM",
    slots: ["11–1 PM", "1–3 PM", "3–5 PM"],
  },
  {
    label: "Evening",
    range: "4 PM – 12 AM",
    slots: ["5–7 PM", "7–9 PM", "9–11 PM", "11 PM–12 AM"],
  },
];
