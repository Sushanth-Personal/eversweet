// src/app/admin/_lib/costing.ts
//
// Shared helpers for turning (ingredient rate + recipe qty) into a
// precise per-piece cost, and for matching purchase descriptions to
// a canonical ingredient name (so "Mango Alphonso" and "Mango Mallika"
// both resolve to a single "mango" rate).

export type Unit = "g" | "kg" | "ml" | "l" | "piece";

export type IngredientRate = {
  id: string;
  item_key: string; // canonical, lowercase
  pack_qty: number;
  pack_unit: Unit;
  price: number;
  notes?: string | null;
};

export type ProductRecipeRow = {
  id: string;
  product_id: string;
  item_key: string;
  qty_per_piece: number;
  unit: Unit;
};

const BASE_UNIT: Record<Unit, Unit> = {
  g: "g",
  kg: "g",
  ml: "ml",
  l: "ml",
  piece: "piece",
};

const TO_BASE_FACTOR: Record<Unit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  piece: 1,
};

export function canonKey(s: string): string {
  return s.trim().toLowerCase();
}

/** Does this purchase description belong to the given canonical ingredient? */
export function matchesIngredient(
  description: string,
  itemKey: string,
): boolean {
  return canonKey(description).includes(canonKey(itemKey));
}

export function toBase(qty: number, unit: Unit): { qty: number; base: Unit } {
  return { qty: qty * TO_BASE_FACTOR[unit], base: BASE_UNIT[unit] };
}

/** Price per single base unit (per gram, per ml, or per piece). */
export function pricePerBaseUnit(rate: {
  pack_qty: number;
  pack_unit: Unit;
  price: number;
}): { pricePerBase: number; base: Unit } {
  const { qty, base } = toBase(rate.pack_qty, rate.pack_unit);
  return { pricePerBase: qty > 0 ? rate.price / qty : 0, base };
}

/**
 * Cost of one recipe line (e.g. "12g mango per piece") given a rate.
 * Returns null if units are incompatible (e.g. recipe in ml, rate in g).
 */
export function ingredientCostPerPiece(
  recipeQty: number,
  recipeUnit: Unit,
  rate: { pack_qty: number; pack_unit: Unit; price: number },
): number | null {
  const { qty: recipeBaseQty, base: recipeBase } = toBase(
    recipeQty,
    recipeUnit,
  );
  const { pricePerBase, base: rateBase } = pricePerBaseUnit(rate);
  if (recipeBase !== rateBase) return null;
  return recipeBaseQty * pricePerBase;
}

export type ProductCostResult = {
  productId: string;
  totalCost: number;
  complete: boolean; // true if every recipe row resolved to a rate
  lines: {
    item_key: string;
    qty_per_piece: number;
    unit: Unit;
    cost: number | null; // null = no matching rate or incompatible unit
  }[];
};

/** Compute the per-piece cost of one product from its recipe + rate table. */
export function computeProductCost(
  productId: string,
  recipe: ProductRecipeRow[],
  rates: IngredientRate[],
): ProductCostResult {
  const rows = recipe.filter((r) => r.product_id === productId);
  const rateByKey = new Map(rates.map((r) => [canonKey(r.item_key), r]));

  let totalCost = 0;
  let complete = rows.length > 0;
  const lines = rows.map((row) => {
    const rate = rateByKey.get(canonKey(row.item_key));
    if (!rate) {
      complete = false;
      return {
        item_key: row.item_key,
        qty_per_piece: row.qty_per_piece,
        unit: row.unit,
        cost: null,
      };
    }
    const cost = ingredientCostPerPiece(row.qty_per_piece, row.unit, rate);
    if (cost === null) complete = false;
    else totalCost += cost;
    return {
      item_key: row.item_key,
      qty_per_piece: row.qty_per_piece,
      unit: row.unit,
      cost,
    };
  });

  return { productId, totalCost, complete, lines };
}
