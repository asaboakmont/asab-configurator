const SHOPIFY_STORE = "xuiduq-y4.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

let allVariants = [];
let cursor = null;
let hasNext = true;

while (hasNext) {
  const query = `{
    productVariants(first: 250${cursor ? `, after: "${cursor}"` : ""}) {
      pageInfo { hasNextPage endCursor }
      edges { node { sku price } }
    }
  }`;

  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": SHOPIFY_TOKEN },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  const pv = data.data.productVariants;
  allVariants.push(...pv.edges.map(e => e.node));
  hasNext = pv.pageInfo.hasNextPage;
  cursor = pv.pageInfo.endCursor;
}

const seen = new Set();
allVariants
  .filter(v => v.sku?.startsWith("F-"))
  .forEach(v => {
    const parts = v.sku.split("-");
    const key = `${parts[1]}-${parts[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(`${key}: ${v.price}`);
    }
  });
