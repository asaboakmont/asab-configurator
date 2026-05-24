import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import type {
  BudgetPreference,
  Cabinet,
  Colorway,
  DesignCollectionId,
  LayoutType,
  RoomConstraints,
  RoomFinishes,
  WallDimensions,
} from "@/types/kitchen";

interface DraftOrderPayload {
  cabinets: Cabinet[];
  colorway: Colorway;
  handle?: string;
  totalPrice: number;
  dimensions: WallDimensions;
  layout: LayoutType;
  contact: { name?: string; phone?: string; email?: string };
  constraints?: RoomConstraints;
  collection?: DesignCollectionId;
  budget?: BudgetPreference;
  roomFinishes?: RoomFinishes;
  previewImage?: string;
}

const SHIPPING_PRICE_RON = 295;

export async function POST(req: NextRequest) {
  const body: DraftOrderPayload = await req.json();
  const {
    cabinets,
    colorway,
    totalPrice,
    layout,
    contact,
    dimensions,
    constraints,
    collection,
    budget,
    roomFinishes,
    previewImage,
  } = body;

  const shopDomain = "xuiduq-y4.myshopify.com";
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN ?? "asab-design.ro";
  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN ?? "";
  const previewUrl = await createPreviewUrl(previewImage);
  const note = buildDraftOrderNote({
    cabinets,
    colorway,
    totalPrice,
    layout,
    contact,
    dimensions,
    constraints,
    collection,
    budget,
    roomFinishes,
    previewImage: previewUrl,
  });

  if (!adminToken) {
    return NextResponse.json({
      checkoutUrl: `https://${storeDomain}/pages/contact?note=${encodeURIComponent(note)}`,
    });
  }

  const draftOrderPayload = {
    draft_order: {
      email: contact?.email || undefined,
      note,
      tags: "ASAB Configurator, Custom Kitchen",
      note_attributes: [
        { name: "Sursa", value: "ASAB configurator" },
        { name: "Colectie", value: collectionLabel(collection) },
        { name: "Layout", value: layoutLabel(layout) },
        { name: "Total configurator", value: `${safeMoney(totalPrice)} RON` },
        { name: "Transport", value: `${SHIPPING_PRICE_RON} RON` },
        { name: "Imagine proiect", value: previewUrl ?? "" },
        { name: "Nume", value: contact?.name ?? "" },
        { name: "Telefon", value: contact?.phone ?? "" },
      ],
      line_items: [
        {
          title: "Bucatarie ASAB configurata",
          price: safeMoney(totalPrice),
          quantity: 1,
          taxable: true,
        },
        {
          title: "Transport",
          price: SHIPPING_PRICE_RON.toFixed(2),
          quantity: 1,
          taxable: true,
        },
      ],
      use_customer_default_address: false,
    },
  };

  const response = await fetch(`https://${shopDomain}/admin/api/2024-01/draft_orders.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminToken,
    },
    body: JSON.stringify(draftOrderPayload),
  });

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    console.error("Shopify draft order failed:", data);
    return NextResponse.json(
      { error: "Nu am putut crea draft order-ul Shopify." },
      { status: 502 }
    );
  }

  const checkoutUrl = data?.draft_order?.invoice_url
    ?? `https://${storeDomain}/pages/contact?note=${encodeURIComponent(note)}`;
  return NextResponse.json({ checkoutUrl, draftOrderId: data?.draft_order?.id });
}

function buildDraftOrderNote({
  cabinets,
  colorway,
  totalPrice,
  layout,
  contact,
  dimensions,
  constraints,
  collection,
  budget,
  roomFinishes,
  previewImage,
}: DraftOrderPayload): string {
  const cabinetLines = cabinets.map((cabinet) => {
    const label = cabinet.label ? ` - ${cabinet.label}` : "";
    return `- ${cabinet.sku}${label} | ${cabinet.width}x${cabinet.height}x${cabinet.depth} cm | Perete ${cabinet.wall} | x=${cabinet.xPos} cm | ${cabinet.price} RON`;
  });

  return [
    "Bucatarie ASAB configurata",
    `Colectie: ${collectionLabel(collection)}`,
    `Layout: ${layoutLabel(layout)}`,
    `Dimensiuni: A ${dimensions?.wallA ?? "-"} cm${dimensions?.wallB ? `, B ${dimensions.wallB} cm` : ""}`,
    `Finisaj: ${colorway.name}`,
    `Blat: ${colorway.worktop}`,
    `Manere: ${colorway.handle}`,
    `Buget: ${budget?.range ?? "neprecizat"}`,
    `Pardoseala: ${roomFinishes?.floorTexture ?? "neprecizata"}`,
    `Faianta: ${roomFinishes?.backsplashTexture ?? "neprecizata"}`,
    `Goluri: ${constraints?.openings?.length ?? 0}`,
    `Obstacole: ${constraints?.obstructions?.length ?? 0}`,
    constraints?.boiler ? "Centrala: da" : "Centrala: nu",
    `Total configurator: ${safeMoney(totalPrice)} RON`,
    `Transport: ${SHIPPING_PRICE_RON.toFixed(2)} RON`,
    previewImage ? `Imagine proiect: ${previewImage}` : undefined,
    contact?.name ? `Client: ${contact.name}` : undefined,
    contact?.phone ? `Telefon: ${contact.phone}` : undefined,
    contact?.email ? `Email: ${contact.email}` : undefined,
    "",
    "Corpuri configurate:",
    ...cabinetLines,
  ].filter(Boolean).join("\n");
}

function safeMoney(value: number): string {
  const amount = Number.isFinite(value) ? Math.max(0, value) : 0;
  return amount.toFixed(2);
}

async function createPreviewUrl(previewImage?: string): Promise<string | undefined> {
  if (!previewImage) return undefined;
  if (/^https?:\/\//i.test(previewImage)) return previewImage;

  const match = previewImage.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) return undefined;

  const [, mime, base64] = match;
  const id = nanoid(12);

  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    await redis.set(`preview:${id}`, JSON.stringify({ mime, base64 }), { ex: 2592000 });
    return `https://configurator.asab-design.ro/api/config/preview?id=${id}`;
  } catch (error) {
    console.warn("Could not store Shopify draft preview image:", error);
    return undefined;
  }
}

function layoutLabel(layout: LayoutType): string {
  const labels: Record<LayoutType, string> = {
    linear: "Liniar",
    "l-shape": "In colt",
    island: "Cu insula",
    peninsula: "Liniar",
  };
  return labels[layout];
}

function collectionLabel(collection?: DesignCollectionId): string {
  const labels: Record<DesignCollectionId, string> = {
    japandi: "Japandi",
    germain: "Germain",
    franc: "Franc",
  };
  return labels[collection ?? "japandi"];
}
