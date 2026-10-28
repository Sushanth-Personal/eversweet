export const normalizedStatus = (o: {status?: string | null}) => (o.status || "pending").trim().toLowerCase();
export function isRealOrder(o: {status?:string|null}) {
  return !["cancelled","deleted","archived"].includes(normalizedStatus(o));
}
export function isActiveOrder(o: {status?:string|null}) {
  return isRealOrder(o) && !["dispatched","completed","delivered"].includes(normalizedStatus(o));
}
