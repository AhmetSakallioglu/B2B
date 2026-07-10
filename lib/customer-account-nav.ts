export type CustomerAccountNavId =
  | "account"
  | "addresses"
  | "orders"
  | "quotes"
  | "client-quotes"
  | "room-templates"
  | "cart";

export type CustomerAccountNavGroup = "account" | "sales" | "checkout";

export type CustomerAccountNavItem = {
  id: CustomerAccountNavId;
  href: string;
  label: string;
  fullLabel: string;
  group: CustomerAccountNavGroup;
};

export const CUSTOMER_ACCOUNT_NAV_GROUPS: Array<{
  id: CustomerAccountNavGroup;
  label: string;
}> = [
  { id: "account", label: "Account" },
  { id: "sales", label: "Sales tools" },
  { id: "checkout", label: "Checkout" },
];

export const CUSTOMER_ACCOUNT_NAV_ITEMS: CustomerAccountNavItem[] = [
  {
    id: "account",
    href: "/account",
    label: "Account",
    fullLabel: "My Account",
    group: "account",
  },
  {
    id: "addresses",
    href: "/account/shipping-addresses",
    label: "Addresses",
    fullLabel: "Shipping Addresses",
    group: "account",
  },
  {
    id: "orders",
    href: "/orders",
    label: "Orders",
    fullLabel: "My Orders",
    group: "account",
  },
  {
    id: "quotes",
    href: "/account/quotes",
    label: "Quotes",
    fullLabel: "My Quotes",
    group: "sales",
  },
  {
    id: "client-quotes",
    href: "/account/client-quotes",
    label: "Client Quotes",
    fullLabel: "My Client Quotes",
    group: "sales",
  },
  {
    id: "room-templates",
    href: "/account/room-templates",
    label: "Room Templates",
    fullLabel: "My Room Templates",
    group: "sales",
  },
  {
    id: "cart",
    href: "/cart",
    label: "Cart",
    fullLabel: "Shopping Cart",
    group: "checkout",
  },
];

export function getCustomerAccountNavItemsByGroup(group: CustomerAccountNavGroup) {
  return CUSTOMER_ACCOUNT_NAV_ITEMS.filter((item) => item.group === group);
}
