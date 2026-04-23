export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category: string;
  is_available: boolean;
  is_premium: boolean;
  sort_order: number;
};

export type BoxSize = {
  id: string;
  label: string;
  count: number;
  price: number;
  is_active: boolean;
  sort_order: number;
};

export type Batch = {
  id: string;
  batch_key: "morning" | "afternoon" | "evening";
  label: string;
  delivery_date: string;
  max_orders: number;
  current_orders: number;
  is_active: boolean;
};

export type Order = {
  id: string;
  customer_name: string;
  phone: string;
  address: string | null;
  dob: string | null;
  box_size_id: string;
  flavours: Record<string, number>;
  delivery_date: string | null;
  delivery_batch: string | null;
  payment_method: string;
  notes: string | null;
  total_price: number;
  status: string;
  created_at: string;
  // Extended fields (from DM orders)
  insta_id?: string;
  remarks?: string;
  source?: string;
  order_date?: string;
};

export type CustomerForm = {
  name: string;
  phone: string;
  address: string;
};
