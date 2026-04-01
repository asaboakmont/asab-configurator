import { readFileSync, writeFileSync } from "fs";

const SHOPIFY_STORE = "xuiduq-y4.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

const query = `{
  productVariants(first: 250) {
    edges {
      node {
        sku
        price
        product { title }
      }
    }
  }
}`;

const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/graphql.json`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": SHOPIFY_TOKEN,
  },
  body: JSON.stringify({ query }),
});

const data = await res.json();
const variants = data.data.productVariants.edges.map(e => e.node);

const priceMap = {};
for (const v of variants) {
  if (!v.sku || v.sku === "null") continue;
  const title = v.product.title;
  if (title.startsWith("CI ") || title.startsWith("CS ") || title.startsWith("Soldat")) {
    priceMap[v.sku] = Math.round(parseFloat(v.price));
  }
}

let content = readFileSync("data/skus.ts", "utf8");
let updated = 0;

for (const [sku, price] of Object.entries(priceMap)) {
  // Match the line containing this SKU and replace price on same or next line
  const escapedSku = sku.replace(/[-]/g, "\\$&");
  const regex = new RegExp(
    `(\\{[^}]*sku:\\s*"${escapedSku}"[^}]*price:\\s*)\\d+`,
    "gs"
  );
  const newContent = content.replace(regex, `$1${price}`);
  if (newContent !== content) {
    content = newContent;
    updated++;
    console.log(`Updated ${sku}: ${price} RON`);
  } else {
    console.log(`No match for ${sku} (price may already be ${price})`);
  }
}

writeFileSync("data/skus.ts", content);
console.log(`\nDone — updated ${updated} SKUs`);
