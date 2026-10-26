export type Selection = {
  box_size_id: string;
  flavours: Record<string, number>;
};
export function layout(notes?: string | null): Selection[] {
  try {
    const value = JSON.parse(
      decodeURIComponent(
        notes?.match(/Box layout:\s*([^|]+)/)?.[1]?.trim() || "[]",
      ),
    );
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
export function mapLink(notes?: string | null) {
  return notes?.match(/Customer map:\s*(https?:\/\/\S+)/)?.[1] || "";
}
export function replaceNote(
  notes: string | null | undefined,
  prefix: string,
  value: string,
) {
  return [
    ...(notes || "")
      .split(" | ")
      .filter((part) => part && !part.startsWith(prefix + ":")),
    ...(value ? [`${prefix}: ${value}`] : []),
  ].join(" | ");
}
export function completeness(
  order: {
    customer_name?: string;
    phone?: string;
    address?: string | null;
    delivery_date?: string | null;
    delivery_slot?: string | null;
    notes?: string | null;
    box_size_id?: string;
    flavours?: Record<string, number>;
  },
  boxes: { id: string; count: number }[],
) {
  const override = order.notes?.match(
    /Details status: (complete|incomplete)/,
  )?.[1];
  const plan = layout(order.notes);
  const missing = [
    !order.customer_name?.trim() && "name",
    !order.phone?.trim() && "phone",
    !order.delivery_date && "date",
    !order.delivery_slot && "time",
    !order.address?.trim() && "address",
    !mapLink(order.notes) && "map link",
  ];
  const valid = plan.length
    ? plan.every((b) => {
        const count = boxes.find((x) => x.id === b.box_size_id)?.count;
        return (
          count &&
          Object.values(b.flavours).reduce((a, n) => a + n, 0) === count
        );
      })
    : Boolean(
        order.box_size_id &&
          (boxes.find((b) => b.id === order.box_size_id)?.count || 0) *
            Number(order.notes?.match(/Box quantity:\s*(\d+)/)?.[1] || 1) ===
            Object.values(order.flavours || {}).reduce((a, n) => a + n, 0),
      );
  if (!valid) missing.push("boxes / flavours");
  return {
    complete: override ? override === "complete" : !missing.some(Boolean),
    missing: missing.filter(Boolean).join(", "),
  };
}
