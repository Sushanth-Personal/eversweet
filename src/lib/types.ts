export type Product = {
  id: string
  name: string
  description: string
  price: number
  image_url: string | null
  category: string
  is_available: boolean
  is_premium: boolean
  sort_order: number
}

export type BoxSize = {
  id: string
  label: string
  count: number
  price: number
  is_active: boolean
  sort_order: number
}

export type TimeSlot = {
  id: string
  label: string
  date: string
  max_orders: number
  current_orders: number
  is_active: boolean
}

export type Order = {
  id: string
  customer_name: string
  phone: string
  address: string | null
  dob: string | null
  box_size_id: string
  flavours: Record<string, number>
  time_slot_id: string
  payment_method: string
  notes: string | null
  total_price: number
  status: string
  created_at: string
}

export type CustomerForm = {
  name: string
  phone: string
  address: string
  dob: string
  notes: string
}
