import type { OrderCustomer } from "@/types/orders";

export function buildCustomerPdfLines(customer: OrderCustomer) {
  const lines: string[] = [];

  if (customer.companyName) {
    lines.push(customer.companyName);
  }

  if (customer.contactName) {
    lines.push(customer.contactName);
  }

  lines.push(customer.email);

  if (customer.phone) {
    lines.push(customer.phone);
  }

  if (customer.addressLine1) {
    lines.push(customer.addressLine1);
  }

  if (customer.addressLine2) {
    lines.push(customer.addressLine2);
  }

  const cityLine = [customer.city, customer.state, customer.postalCode]
    .filter(Boolean)
    .join(", ");

  if (cityLine) {
    lines.push(cityLine);
  }

  if (customer.country) {
    lines.push(customer.country);
  }

  return lines;
}

export function formatCustomerAddress(customer: OrderCustomer) {
  return buildCustomerPdfLines(customer)
    .filter((line) => line !== customer.email)
    .join("\n");
}
