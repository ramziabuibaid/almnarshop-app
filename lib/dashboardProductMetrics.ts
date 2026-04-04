/**
 * Dashboard summaries from admin product rows (mapped Supabase / getProducts shape).
 */

export const LOW_STOCK_THRESHOLD = 5;

export type ProductRowLite = {
  ProductID?: string;
  id?: string;
  product_id?: string;
  Name?: string;
  name?: string;
  Type?: string;
  type?: string;
  CS_Shop?: number;
  CS_War?: number;
  cs_shop?: number;
  cs_war?: number;
  Image?: string;
  image?: string;
  image_url?: string;
  is_visible?: boolean;
  isVisible?: boolean;
  last_restocked_at?: string | null;
  LastRestockedAt?: string | null;
};

export type ProductStockRow = {
  id: string;
  name: string;
  typeLabel: string;
  shop: number;
  war: number;
  total: number;
  restock: string | null;
  hasImage: boolean;
  visible: boolean;
};

export interface ProductDashboardMetrics {
  totalSkus: number;
  visibleInStore: number;
  hiddenFromStore: number;
  withoutImage: number;
  totalShopUnits: number;
  totalWarehouseUnits: number;
  totalUnits: number;
  outOfStockCount: number;
  lowStockCount: number;
  typePie: Array<{ name: string; value: number }>;
  outOfStock: ProductStockRow[];
  lowStock: ProductStockRow[];
  topStocked: ProductStockRow[];
  recentlyRestocked: ProductStockRow[];
}

function productId(p: ProductRowLite): string {
  return String(p.ProductID || p.id || p.product_id || '').trim();
}

function toStockRow(p: ProductRowLite): ProductStockRow | null {
  const id = productId(p);
  if (!id) return null;
  const shop = Number(p.CS_Shop ?? p.cs_shop ?? 0) || 0;
  const war = Number(p.CS_War ?? p.cs_war ?? 0) || 0;
  const img = p.Image || p.image || p.image_url;
  const hasImage = !!(img && String(img).trim());
  const visible = p.is_visible !== false && p.isVisible !== false;
  const restock = (p.last_restocked_at || p.LastRestockedAt || null) as string | null;
  const typeLabel = String(p.Type || p.type || '').trim() || 'بدون نوع';
  return {
    id,
    name: String(p.Name || p.name || id).trim() || id,
    typeLabel,
    shop,
    war,
    total: shop + war,
    restock,
    hasImage,
    visible,
  };
}

export function computeProductDashboardMetrics(products: ProductRowLite[]): ProductDashboardMetrics {
  const rows: ProductStockRow[] = [];
  for (const p of products) {
    const r = toStockRow(p);
    if (r) rows.push(r);
  }

  let visibleInStore = 0;
  let hiddenFromStore = 0;
  let withoutImage = 0;
  let totalShopUnits = 0;
  let totalWarehouseUnits = 0;
  const typeCounts = new Map<string, number>();

  for (const r of rows) {
    if (r.visible) visibleInStore++;
    else hiddenFromStore++;
    if (!r.hasImage) withoutImage++;
    totalShopUnits += r.shop;
    totalWarehouseUnits += r.war;
    typeCounts.set(r.typeLabel, (typeCounts.get(r.typeLabel) || 0) + 1);
  }

  const totalUnits = totalShopUnits + totalWarehouseUnits;

  const outOfStock = rows.filter((r) => r.total === 0);
  const lowStock = rows.filter((r) => r.total > 0 && r.total <= LOW_STOCK_THRESHOLD);

  const topStocked = [...rows].sort((a, b) => b.total - a.total).slice(0, 12);

  const recentlyRestocked = [...rows]
    .filter((r) => r.restock)
    .sort((a, b) => {
      const ta = new Date(a.restock as string).getTime();
      const tb = new Date(b.restock as string).getTime();
      return tb - ta;
    })
    .slice(0, 10);

  const typesSorted = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);
  const MAX_SLICES = 7;
  const typePie: Array<{ name: string; value: number }> = [];
  let other = 0;
  typesSorted.forEach(([name, value], i) => {
    if (i < MAX_SLICES) typePie.push({ name, value });
    else other += value;
  });
  if (other > 0) typePie.push({ name: 'أخرى', value: other });

  return {
    totalSkus: rows.length,
    visibleInStore,
    hiddenFromStore,
    withoutImage,
    totalShopUnits,
    totalWarehouseUnits,
    totalUnits,
    outOfStockCount: outOfStock.length,
    lowStockCount: lowStock.length,
    typePie: typePie.filter((s) => s.value > 0),
    outOfStock: [...outOfStock].sort((a, b) => a.name.localeCompare(b.name, 'ar')).slice(0, 25),
    lowStock: [...lowStock].sort((a, b) => a.total - b.total).slice(0, 25),
    topStocked,
    recentlyRestocked,
  };
}
