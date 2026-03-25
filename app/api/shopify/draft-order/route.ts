import { NextRequest, NextResponse } from "next/server";
import type { Cabinet, Colorway, LayoutType, WallDimensions } from "@/types/kitchen";

interface DraftOrderPayload {
  cabinets:   Cabinet[];
  colorway:   Colorway;
  handle:     string;
  totalPrice: number;
  dimensions: WallDimensions;
  layout:     LayoutType;
  contact:    { name?: string; phone?: string; email?: string };
}

const SKU_TO_HANDLE: Record<string, string> = {
  // Door fronts
  ...Object.fromEntries(
    ["alb-mat","gri-deschis-mat","gri-inchis-mat","olive-mat","negru-mat","albastru-mat",
     "stejar","crem-lucios","alb-lucios","gri-deschis-lucios","gri-inchis-lucios","olive-lucios","negru-lucios"]
    .flatMap(cw => ["B","W","T"].flatMap(t => [40,45,50,60,80,95,100].flatMap(w => [
      [`F-${t}-${w}-${cw.toUpperCase()}-S`, `front-${t.toLowerCase()}-${w}cm-${cw}-s`],
      [`F-${t}-${w}-${cw.toUpperCase()}-D`, `front-${t.toLowerCase()}-${w}cm-${cw}-d`]
    ])))
  ),
  // Worktops
  "BL-STEJAR": "blat-stejar",
  "BL-GRIS":   "blat-gri-piatra",
  // Carcass cabinets
  "1001-DR":  "ci-colt-950mm-dreapta",
  "1001-STG": "ci-colt-950mm-stanga",
  "1003":     "ci-600mm-3-sertare",
  "1004":     "ci-500mm-1-usa",
  "1005":     "ci-800mm-chiuveta-2-usi",
  "1006":     "ci-600mm-cuptor-1-usa",
  "1007":     "ci-600mm-chiuveta-1-usa",
  "1008":     "ci-400mm-1-usa",
  "1010":     "ci-600mm-1-usa",
  "1013":     "ci-800mm-2-usi",
  "1014":     "ci-450mm-1-usa",
  "1015":     "ci-600mm-front-masina-vase",
  "1015-45":  "ci-450mm-front-masina-vase",
  "1003-HOB-60": "ci-600mm-plita-3-sertare",
  "1003-HOB-80": "ci-800mm-plita-3-sertare",
  "2001-DR":  "cs-colt-1000mm-dreapta",
  "2001-STG": "cs-colt-1000mm-stanga",
  "2004":     "cs-500mm-1-usa",
  "2007":     "cs-600mm-hota",
  "2008":     "cs-400mm-1-usa",
  "2010":     "cs-600mm-1-usa",
  "2013":     "cs-800mm-2-usi",
  "2014":     "cs-450mm-1-usa",
  "1011A":    "soldat-600mm-2-usi",
  "1011B":    "soldat-600mm-cuptor",
  "1011C":    "soldat-600mm-cuptor-microunde",
  "1016":     "soldat-600mm-frigider",
};

// Generate door SKU from cabinet SKU + colorway
function getDoorSku(cabSku: string, colorwayId: string, direction: string = "S"): string | null {
  const SKU_TO_DOOR: Record<string, [string, number]> = {
    // Base cabinets [type, width]
    "1001-DR": ["B", 95], "1001-STG": ["B", 95],
    "1003": ["B", 60], "1004": ["B", 50], "1005": ["B", 80], "1006": ["B", 60],
    "1007": ["B", 60], "1008": ["B", 40], "1010": ["B", 60], "1013": ["B", 80],
    "1014": ["B", 45], "1015": ["B", 60], "1015-45": ["B", 45],
    "1003-HOB-60": ["B", 60], "1003-HOB-80": ["B", 80],
    // Wall cabinets
    "2001-DR": ["W", 100], "2001-STG": ["W", 100],
    "2004": ["W", 50], "2007": ["W", 60], "2008": ["W", 40], "2010": ["W", 60],
    "2013": ["W", 80], "2014": ["W", 45],
    // Tall cabinets
    "1011A": ["T", 60], "1011B": ["T", 60], "1011C": ["T", 60], "1016": ["T", 60],
  };
  const entry = SKU_TO_DOOR[cabSku];
  if (!entry) return null;
  const [cabType, width] = entry;
  return `F-${cabType}-${width}-${colorwayId.toUpperCase()}-${direction.toUpperCase()}`;
}

// Worktop handles
const WORKTOP_HANDLES: Record<string, string> = {
  "stejar":     "blat-stejar",
  "gri-piatra": "blat-gri-piatra",
};

export async function POST(req: NextRequest) {
  const body: DraftOrderPayload = await req.json();
  const { cabinets, colorway, totalPrice, layout, contact, dimensions } = body;

  const shopDomain = "xuiduq-y4.myshopify.com";
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN ?? "asab-design.ro";
  const adminToken  = process.env.SHOPIFY_ADMIN_TOKEN ?? "";

  const note = encodeURIComponent(
    `Bucatarie ASAB | ${layout === "l-shape" ? "L" : "Liniar"} | ${colorway.name} | ${totalPrice} RON${contact?.name ? " | " + contact.name : ""}${contact?.phone ? " | " + contact.phone : ""}`
  );

  // Get unique SKUs to look up — both carcass and door SKUs
  const carcassSkus = Array.from(new Set(cabinets.map(c => c.sku)));
  const doorSkus = Array.from(new Set(cabinets
    .map(c => getDoorSku(c.sku, colorway.id, c.doorDirection ?? "S"))
    .filter(Boolean) as string[]));
  const worktopHandle = WORKTOP_HANDLES[colorway.worktop];
  const worktopSku = colorway.worktop === "stejar" ? "BL-STEJAR" : "BL-GRIS";
  const uniqueSkus = [...carcassSkus, ...doorSkus, worktopSku];
  const variantMap: Record<string, string> = {};

  if (adminToken) {
    await Promise.all(uniqueSkus.map(async (sku) => {
      const handle = SKU_TO_HANDLE[sku];
      if (!handle) return;
      try {
        const res = await fetch(
          `https://${shopDomain}/admin/api/2024-01/products.json?handle=${handle}&fields=variants`,
          { headers: { "X-Shopify-Access-Token": adminToken } }
        );
        const data = await res.json();
        console.log(`Handle ${handle} -> products: ${data?.products?.length}, first variant: ${data?.products?.[0]?.variants?.[0]?.id}`);
        const vid = data?.products?.[0]?.variants?.[0]?.id;
        if (vid) variantMap[sku] = String(vid);
      } catch { /* skip */ }
    }));
  }

  // Calculate worktop length in linear meters (rounded up)
  // wallA + wallB + 60cm corner overlap
  const worktopLengthCm = (dimensions?.wallA ?? 300) + (layout === "l-shape" ? (dimensions?.wallB ?? 0) : 0);
  const worktopMeters = Math.ceil(worktopLengthCm / 100);

  // Build cart items with quantities
  const qtyMap: Record<string, number> = {};

  // Add worktop
  if (variantMap[worktopSku]) {
    qtyMap[variantMap[worktopSku]] = worktopMeters;
  }

  for (const c of cabinets) {
    if (variantMap[c.sku]) {
      qtyMap[variantMap[c.sku]] = (qtyMap[variantMap[c.sku]] ?? 0) + 1;
    }
    const doorSku = getDoorSku(c.sku, colorway.id, c.doorDirection ?? "S");
    if (doorSku && variantMap[doorSku]) {
      qtyMap[variantMap[doorSku]] = (qtyMap[variantMap[doorSku]] ?? 0) + 1;
    }
  }
  const cartItems = Object.entries(qtyMap).map(([vid, qty]) => `${vid}:${qty}`).join(",");

  if (cartItems) {
    const checkoutUrl = `https://${storeDomain}/cart/${cartItems}?note=${note}`;
    return NextResponse.json({ checkoutUrl });
  }

  // Fallback
  return NextResponse.json({
    checkoutUrl: `https://${storeDomain}/pages/contact?note=${note}`
  });
}

