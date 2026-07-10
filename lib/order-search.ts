import type { OrderWithCustomer } from "@/types/orders";

function normalizeSearchQuery(value: string) {
  return value.trim().toLowerCase();
}

function orderMatchesSku(order: OrderWithCustomer, query: string) {
  return order.items.some((item) => {
    const productSku = item.productSku.toLowerCase();
    const variantSku = item.variantSku.toLowerCase();
    return productSku.includes(query) || variantSku.includes(query);
  });
}

export function matchesOrderSearch(order: OrderWithCustomer, rawQuery: string) {
  const query = normalizeSearchQuery(rawQuery);

  if (!query) {
    return true;
  }

  const orderIdText = String(order.id);
  const normalizedOrderId = query.replace(/^#/, "");

  if (orderIdText.includes(normalizedOrderId)) {
    return true;
  }

  const customer = order.customer;

  if (customer.contactName.toLowerCase().includes(query)) {
    return true;
  }

  if (customer.companyName.toLowerCase().includes(query)) {
    return true;
  }

  if (customer.email.toLowerCase().includes(query)) {
    return true;
  }

  return orderMatchesSku(order, query);
}
