const SHOPIFY_STORE = "xuiduq-y4.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

const query = `{
  productVariants(first: 250) {
    edges {
      node { sku price }
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
const seen = new Set();
data.data.productVariants.edges
  .filter(e => e.node.sku?.startsWith("F-W") || e.node.sku?.startsWith("F-T"))
  .forEach(e => {
    const parts = e.node.sku.split("-");
    const key = `${parts[1]}-${parts[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(`${key}: ${e.node.price}`);
    }
  });
