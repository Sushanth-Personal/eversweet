/** Customer links identify one order; browser storage never determines identity. */
export function customerOrderLock(order: {status: string; delivery_date?: string | null}, today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata'}).format(new Date())) {
  if (order.status === 'cancelled') return 'This order has been cancelled. Please contact Eversweet for a new order.';
  if (order.status === 'dispatched') return 'This order has been dispatched. For another order, please contact Eversweet for a new link.';
  if (!order.delivery_date) return '';
  return '';
}
export function fixedOrderDetailsError(old: {delivery_date?: string | null; source?: string | null}, body: {delivery_date?: unknown; location?: unknown}) {
  if (old.delivery_date && (body.delivery_date !== old.delivery_date || body.location !== (old.source === 'trivandrum' ? 'trivandrum' : old.source === 'kozhikode' ? 'kozhikode' : 'kochi'))) return 'The date and city are fixed for this order. Please contact Eversweet to reschedule.';
  return '';
}
