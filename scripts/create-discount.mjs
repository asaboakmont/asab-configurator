// scripts/create-discount.mjs
// Run once: node scripts/create-discount.mjs
// This creates an automatic 21.4% discount on all products in your Shopify store.
// After running, go to Shopify Admin → Discounts to manually exclude any products (e.g. worktop).

const SHOPIFY_DOMAIN = "xuiduq-y4.myshopify.com";
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/graphql.json`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": ADMIN_TOKEN,
  },
  body: JSON.stringify({
    query: `
      mutation {
        discountAutomaticBasicCreate(automaticBasicDiscount: {
          title: "Reducere 20% ASAB"
          startsAt: "2025-01-01T00:00:00Z"
          customerGets: {
            value: { percentage: 0.20 }
            items: { all: true }
          }
        }) {
          automaticDiscountNode {
            id
            automaticDiscount {
              ... on DiscountAutomaticBasic {
                title
                startsAt
                customerGets {
                  value {
                    ... on DiscountPercentage { percentage }
                  }
                }
              }
            }
          }
          userErrors { field message }
        }
      }
    `,
  }),
});

const data = await res.json();

if (data?.data?.discountAutomaticBasicCreate?.userErrors?.length > 0) {
  console.error("❌ Errors:", data.data.discountAutomaticBasicCreate.userErrors);
} else {
  const node = data?.data?.discountAutomaticBasicCreate?.automaticDiscountNode;
  console.log("✅ Discount created:", JSON.stringify(node, null, 2));
  console.log("\n👉 Go to Shopify Admin → Discounts to exclude specific products (e.g. worktop, frigider).");
}
