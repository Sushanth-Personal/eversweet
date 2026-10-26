export function flavourTone(name: string) {
  const key = name.toLowerCase().replace(/mochi|\s+/g, "");
  const familiar: Record<string, number> = {
    butterscotch: 0,
    milkchoconuts: 1,
    milkchoconutsmochi: 1,
    mango: 2,
    biscoff: 3,
    blueberry: 4,
    hazelnut: 1,
    strawberry: 0,
    kiwi: 2,
    pistachio: 2,
    lemoncurd: 1,
    darkchocolate: 4,
    coffeenuts: 3,
    greenapple: 2,
    pomegranate: 0,
  };
  if (key in familiar) return familiar[key];
  return (
    Array.from(name.toLowerCase()).reduce(
      (hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0,
      0,
    ) % 5
  );
}
export default function FlavourChips({
  flavours,
  products,
}: {
  flavours: Record<string, number>;
  products: { id: string; name: string }[];
}) {
  return (
    <div className="order-flavour-chips">
      {Object.entries(flavours)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => {
          const name =
            products.find((p) => p.id === id)?.name || "Unavailable flavour";
          return (
            <span key={id} className={`flavour-chip tone-${flavourTone(name)}`}>
              <strong>{n}</strong>
              <span>{name}</span>
            </span>
          );
        })}
    </div>
  );
}
