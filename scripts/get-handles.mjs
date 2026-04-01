const SHOPIFY_STORE = "xuiduq-y4.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

const query = `{
  products(first: 100) {
    edges {
      node {
        handle
        variants(first: 5) {
          edges {
            node { sku }
          }
        }
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
data.data.products.edges.forEach(e => {
  const skus = e.node.variants.edges.map(v => v.node.sku).filter(s => s && s !== "null");
  if (skus.length) console.log(`"${skus[0]}": "${e.node.handle}",`);
});
