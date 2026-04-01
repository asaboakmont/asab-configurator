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
data.data.productVariants.edges
  .filter(e => e.node.sku?.startsWith("F-"))
  .slice(0, 30)
  .forEach(e => console.log(`SKU: ${e.node.sku} | Price: ${e.node.price}`));
