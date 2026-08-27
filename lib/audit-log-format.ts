import { formatPrice } from "@/lib/order-display";
import type { AuditLogRow } from "@/types/audit-log";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function readString(values: Record<string, unknown> | null | undefined, key: string) {
  const value = values?.[key];
  return typeof value === "string" ? value : null;
}

function readNumber(values: Record<string, unknown> | null | undefined, key: string) {
  const value = values?.[key];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function entityLabel(tableName: string, values: Record<string, unknown> | null | undefined) {
  if (tableName === "product_variants") {
    return readString(values, "sku") ?? "variant";
  }

  if (tableName === "products") {
    return readString(values, "sku") ?? readString(values, "name") ?? "product";
  }

  if (tableName === "door_finishes") {
    return readString(values, "name") ?? "finish";
  }

  if (tableName === "users") {
    const email = readString(values, "email");
    const tier = values?.tier as Record<string, unknown> | undefined;
    const tierName = tier ? readString(tier, "tier_name") : null;

    if (tierName) {
      return `${email ?? "user"} tier (${tierName})`;
    }

    if (email) {
      return email;
    }

    return "user";
  }

  if (tableName === "customer_tiers") {
    return readString(values, "name") ?? "customer tier";
  }

  if (tableName === "quotes") {
    return readString(values, "quote_name") ?? "quote";
  }

  if (tableName === "announcement_popups") {
    return (
      readString(values, "title") ??
      readString(values, "template_title") ??
      readString(values, "name") ??
      "dealer announcement popup"
    );
  }

  if (tableName === "orders") {
    return readString(values, "order_label") ?? "order";
  }

  if (tableName === "email_templates") {
    return readString(values, "template_name") ?? "email template";
  }

  if (tableName === "dealer_groups") {
    return readString(values, "name") ?? "dealer group";
  }

  if (tableName === "admin_permissions") {
    const targetEmail = readString(values, "target_email");
    return targetEmail ? `admin permissions (${targetEmail})` : "admin permissions";
  }

  if (tableName === "shipping_zones") {
    return readString(values, "zone_name") ?? "shipping zone";
  }

  if (tableName === "categories" || tableName === "sub_categories") {
    return readString(values, "name") ?? "category";
  }

  return "record";
}

export function formatAuditLogSummary(row: AuditLogRow & { user_email?: string | null }) {
  const actor = row.user_email ?? "System";
  const when = formatTimestamp(row.created_at);
  const label = entityLabel(row.table_name, row.new_values ?? row.old_values);

  if (row.action === "USER_TAX_EXEMPTION_APPROVED" && row.table_name === "users") {
    const targetEmail = readString(row.new_values, "targetUserEmail") ?? label;
    return `${actor} approved tax exemption for ${targetEmail} on ${when}.`;
  }

  if (row.action === "USER_TAX_EXEMPTION_REJECTED" && row.table_name === "users") {
    const targetEmail = readString(row.new_values, "targetUserEmail") ?? label;
    const reason = readString(row.new_values, "rejectionReason");
    return `${actor} rejected tax exemption for ${targetEmail}${reason ? ` (${reason})` : ""} on ${when}.`;
  }

  if (row.action === "CREATE" && row.table_name === "orders") {
    const summary = readString(row.new_values, "summary");

    if (summary) {
      return summary;
    }

    const orderLabel = readString(row.new_values, "order_label") ?? label;
    const dealerName = readString(row.new_values, "dealer_name");
    return `${actor} placed ${orderLabel}${dealerName ? ` on behalf of ${dealerName}` : ""} on ${when}.`;
  }

  if (row.action === "UPDATE" && row.table_name === "orders") {
    const summary = readString(row.new_values, "summary");

    if (summary) {
      return summary;
    }
  }

  if (row.action === "CREATE" && row.table_name === "users") {
    const summary = readString(row.new_values, "summary");

    if (summary) {
      return summary;
    }

    return `${actor} created member ${readString(row.new_values, "email") ?? label} on ${when}.`;
  }

  if (row.action === "UPDATE" && row.table_name === "users") {
    const summary = readString(row.new_values, "summary");

    if (summary) {
      return summary;
    }
  }

  if (
    (row.action === "CREATE" ||
      row.action === "UPDATE" ||
      row.action === "SOFT_DELETE") &&
    (row.table_name === "email_templates" ||
      row.table_name === "dealer_groups" ||
      row.table_name === "shipping_zones" ||
      row.table_name === "categories" ||
      row.table_name === "sub_categories")
  ) {
    const summary = readString(row.new_values, "summary");

    if (summary) {
      return summary;
    }
  }

  if (row.action === "CREATE" && row.table_name === "quotes") {
    const quoteName = readString(row.new_values, "quote_name");
    const total = readNumber(row.new_values, "total_amount");
    return `${actor} saved quote ${quoteName ?? label}${
      total !== null ? ` (${formatPrice(total)})` : ""
    } on ${when}.`;
  }

  if (row.action === "UPDATE" && row.table_name === "quotes") {
    const event = readString(row.new_values, "event");

    if (event === "admin_view") {
      const customerEmail = readString(row.new_values, "customer_email");
      return `${actor} reviewed quote ${readString(row.new_values, "quote_name") ?? label}${
        customerEmail ? ` for ${customerEmail}` : ""
      } on ${when}.`;
    }

    if (event === "archive") {
      return `${actor} archived quote ${readString(row.new_values, "quote_name") ?? label} on ${when}.`;
    }

    if (event === "restore") {
      return `${actor} restored quote ${readString(row.new_values, "quote_name") ?? label} from archive on ${when}.`;
    }

    if (event === "ordered") {
      return `${actor} archived quote ${readString(row.new_values, "quote_name") ?? label} after placing an order on ${when}.`;
    }
  }

  if (row.action === "CREATE" && row.table_name === "customer_tiers") {
    const discount = readNumber(row.new_values, "discount_percent");
    return `${actor} created customer tier ${label}${
      discount !== null ? ` (${discount}% discount)` : ""
    } on ${when}.`;
  }

  if (row.action === "CREATE" && row.table_name === "products") {
    const summary = readString(row.new_values, "summary");

    if (summary) {
      return summary;
    }
  }

  if (row.action === "CREATE" && row.table_name === "announcement_popups") {
    return `${actor} created pop-up campaign "${label}" on ${when}.`;
  }

  if (row.action === "CREATE") {
    return `${actor} created ${label} on ${when}.`;
  }

  if (row.action === "SOFT_DELETE" && row.table_name === "customer_tiers") {
    return `${actor} deleted customer tier ${label} on ${when}.`;
  }

  if (row.action === "SOFT_DELETE" && row.table_name === "announcement_popups") {
    return `${actor} deleted pop-up campaign "${label}" on ${when}.`;
  }

  if (row.action === "SOFT_DELETE") {
    return `${actor} soft-deleted ${label} on ${when}.`;
  }

  if (row.action === "RESTORE") {
    return `${actor} restored ${label} on ${when}.`;
  }

  if (row.action === "UPDATE" && row.table_name === "products") {
    const summary = readString(row.new_values, "summary");

    if (summary) {
      return summary;
    }

    const oldName = readString(row.old_values, "name");
    const newName = readString(row.new_values, "name");

    if (oldName && newName && oldName !== newName) {
      return `${actor} renamed cabinet ${readString(row.old_values, "sku") ?? label} from "${oldName}" to "${newName}" on ${when}.`;
    }
  }

  if (row.action === "UPDATE" && row.table_name === "product_variants") {
    const oldPrice = readNumber(row.old_values, "price");
    const newPrice = readNumber(row.new_values, "price");

    if (oldPrice !== null && newPrice !== null && oldPrice !== newPrice) {
      return `${actor} updated ${label} price from ${formatPrice(oldPrice)} to ${formatPrice(newPrice)} on ${when}.`;
    }

    const oldStock = readString(row.old_values, "stock_status");
    const newStock = readString(row.new_values, "stock_status");

    if (oldStock && newStock && oldStock !== newStock) {
      return `${actor} updated ${label} stock from ${oldStock.replace("_", " ")} to ${newStock.replace("_", " ")} on ${when}.`;
    }
  }

  if (row.action === "UPDATE" && row.table_name === "door_finishes") {
    const oldActive = row.old_values?.is_active;
    const newActive = row.new_values?.is_active;

    if (typeof oldActive === "boolean" && typeof newActive === "boolean" && oldActive !== newActive) {
      return `${actor} set finish ${label} to ${newActive ? "active" : "inactive"} on ${when}.`;
    }
  }

  if (row.action === "UPDATE" && row.table_name === "users") {
    const summary = readString(row.new_values, "summary");

    if (summary) {
      return summary;
    }

    const oldTier = row.old_values?.tier as Record<string, unknown> | undefined;
    const newTier = row.new_values?.tier as Record<string, unknown> | undefined;

    if (oldTier || newTier) {
      const oldName = oldTier ? readString(oldTier, "tier_name") ?? "No tier" : "No tier";
      const newName = newTier ? readString(newTier, "tier_name") ?? "No tier" : "No tier";
      return `${actor} changed member tier from ${oldName} to ${newName} on ${when}.`;
    }

    const oldStatus = readString(row.old_values, "account_status");
    const newStatus = readString(row.new_values, "account_status");

    if (oldStatus && newStatus && oldStatus !== newStatus) {
      return `${actor} changed account status for ${label} from ${oldStatus} to ${newStatus} on ${when}.`;
    }
  }

  if (row.action === "UPDATE" && row.table_name === "customer_tiers") {
    const oldDiscount = readNumber(row.old_values, "discount_percent");
    const newDiscount = readNumber(row.new_values, "discount_percent");

    if (oldDiscount !== null && newDiscount !== null && oldDiscount !== newDiscount) {
      return `${actor} updated tier ${label} discount from ${oldDiscount}% to ${newDiscount}% on ${when}.`;
    }
  }

  if (row.action === "UPDATE" && row.table_name === "admin_permissions") {
    const summary = readString(row.new_values, "summary");

    if (summary) {
      return summary;
    }
  }

  if (row.action === "UPDATE" && row.table_name === "announcement_popups") {
    const event = readString(row.new_values, "event");

    if (event === "force_reshow") {
      return `${actor} forced pop-up campaign "${label}" to reshow for all dealers on ${when}.`;
    }

    if (event === "toggle_active") {
      const newActive = row.new_values?.is_active;

      if (typeof newActive === "boolean") {
        return `${actor} ${newActive ? "activated" : "deactivated"} pop-up campaign "${label}" on ${when}.`;
      }
    }

    const oldActive = row.old_values?.is_active;
    const newActive = row.new_values?.is_active;

    if (typeof oldActive === "boolean" && typeof newActive === "boolean" && oldActive !== newActive) {
      return `${actor} ${newActive ? "activated" : "deactivated"} pop-up campaign "${label}" on ${when}.`;
    }

    const oldDelay = readNumber(row.old_values, "display_delay");
    const newDelay = readNumber(row.new_values, "display_delay");

    if (oldDelay !== null && newDelay !== null && oldDelay !== newDelay) {
      return `${actor} changed ${label} display delay from ${oldDelay}s to ${newDelay}s on ${when}.`;
    }

    const oldMode = readString(row.old_values, "display_mode");
    const newMode = readString(row.new_values, "display_mode");

    if (oldMode && newMode && oldMode !== newMode) {
      return `${actor} switched ${label} display mode from ${oldMode} to ${newMode} on ${when}.`;
    }

    return `${actor} updated pop-up campaign "${label}" on ${when}.`;
  }

  return `${actor} updated ${label} on ${when}.`;
}
