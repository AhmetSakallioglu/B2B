import { formatPrice } from "@/lib/order-display";
import {
  adminPushUrl,
  dispatchAdminPush,
  sendAdminPushToPermissionTarget,
} from "@/lib/web-push/send";

export function notifyAdminsNewDealerApplication(params: { companyName: string }) {
  dispatchAdminPush(async () => {
    await sendAdminPushToPermissionTarget("can_approve_users", {
      title: "New Dealer Application",
      body: `👤 New Dealer Application: ${params.companyName} awaiting verification`,
      tag: "dealer-application",
      url: adminPushUrl("/admin/users"),
    });
  });
}

export function notifyAdminsNewOrderPlaced(params: { orderId: number; totalPrice: number }) {
  dispatchAdminPush(async () => {
    await sendAdminPushToPermissionTarget("can_view_orders", {
      title: "New Order Placed",
      body: `🛒 New Order Placed (Awaiting Review)! Order #${params.orderId} - ${formatPrice(params.totalPrice)} - Check and approve items before payment.`,
      tag: `order-${params.orderId}-placed`,
      url: adminPushUrl(`/admin/orders/${params.orderId}`),
    });
  });
}

export function notifyAdminsPaymentConfirmed(params: { orderId: number; totalPrice: number }) {
  dispatchAdminPush(async () => {
    await sendAdminPushToPermissionTarget("can_view_orders", {
      title: "Payment Confirmed",
      body: `💳 Payment Confirmed! Order #${params.orderId} - ${formatPrice(params.totalPrice)} received via Stripe.`,
      tag: `order-${params.orderId}-paid`,
      url: adminPushUrl(`/admin/orders/${params.orderId}`),
    });
  });
}
