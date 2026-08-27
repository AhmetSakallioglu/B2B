import { query } from "@/lib/db";
import type { OrderCartItem } from "@/types/catalog";
import { isArchivedQuoteStatus, quoteDisplayTotal } from "@/lib/quote-validation";
import type {
  AdminQuoteDetail,
  AdminQuoteSummary,
  QuoteDetail,
  QuoteRow,
  QuoteSummary,
} from "@/types/quotes";
import { writeAuditLog } from "@/lib/audit-log";

const QUOTE_SELECT = `
  id,
  user_id,
  quote_name,
  items,
  total_amount,
  COALESCE(admin_discount_percent, 0)::text AS admin_discount_percent,
  status,
  created_at,
  updated_at
`;

export type QuoteListFilter = {
  archived?: boolean;
};

function quoteArchiveClause(archived: boolean, column = "status") {
  return archived ? `${column} = 'archived'` : `${column} <> 'archived'`;
}

export function quoteItemsFingerprint(items: Array<{ id: string; quantity: number }>) {
  const quantities = new Map<string, number>();

  for (const item of items) {
    const variantId = String(item.id);
    const quantity = Number(item.quantity);

    if (!variantId || !Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    quantities.set(variantId, (quantities.get(variantId) ?? 0) + quantity);
  }

  return [...quantities.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([variantId, quantity]) => `${variantId}:${quantity}`)
    .join("|");
}

function parseQuoteItems(value: unknown): OrderCartItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value as OrderCartItem[];
}

function mapQuoteSummary(row: QuoteRow): QuoteSummary {
  const items = parseQuoteItems(row.items);
  const totalAmount = Number.parseFloat(row.total_amount);
  const adminDiscountPercent = Number.parseFloat(row.admin_discount_percent ?? "0") || 0;

  return {
    id: row.id,
    quoteName: row.quote_name,
    totalAmount,
    displayTotalAmount: quoteDisplayTotal(totalAmount, adminDiscountPercent),
    adminDiscountPercent,
    status: row.status,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQuoteDetail(row: QuoteRow): QuoteDetail {
  const items = parseQuoteItems(row.items);

  return {
    ...mapQuoteSummary(row),
    items,
    userId: row.user_id,
  };
}

export async function createQuote(params: {
  userId: number;
  quoteName: string;
  items: OrderCartItem[];
  totalAmount: number;
}) {
  const result = await query<QuoteRow>(
    `
      INSERT INTO quotes (user_id, quote_name, items, total_amount, status)
      VALUES ($1, $2, $3::jsonb, $4, 'draft')
      RETURNING ${QUOTE_SELECT}
    `,
    [params.userId, params.quoteName, JSON.stringify(params.items), params.totalAmount]
  );

  return mapQuoteDetail(result.rows[0]);
}

export async function listQuotesForUser(userId: number, filter: QuoteListFilter = {}) {
  const archived = filter.archived === true;
  const result = await query<QuoteRow>(
    `
      SELECT ${QUOTE_SELECT}
      FROM quotes
      WHERE user_id = $1
        AND ${quoteArchiveClause(archived)}
      ORDER BY updated_at DESC, id DESC
    `,
    [userId]
  );

  return result.rows.map(mapQuoteSummary);
}

export async function getQuoteForUser(quoteId: number, userId: number) {
  const result = await query<QuoteRow>(
    `
      SELECT ${QUOTE_SELECT}
      FROM quotes
      WHERE id = $1 AND user_id = $2
    `,
    [quoteId, userId]
  );

  const row = result.rows[0];
  return row ? mapQuoteDetail(row) : null;
}

export async function listQuotesForAdmin(filter: QuoteListFilter = {}) {
  const archived = filter.archived === true;
  const result = await query<
    QuoteRow & {
      customer_email: string;
      company_name: string | null;
      contact_name: string | null;
    }
  >(
    `
      SELECT
        q.id,
        q.user_id,
        q.quote_name,
        q.items,
        q.total_amount,
        COALESCE(q.admin_discount_percent, 0)::text AS admin_discount_percent,
        q.status,
        q.created_at,
        q.updated_at,
        u.email AS customer_email,
        u.company_name,
        u.contact_name
      FROM quotes q
      JOIN users u ON u.id = q.user_id
      WHERE ${quoteArchiveClause(archived, "q.status")}
      ORDER BY q.updated_at DESC, q.id DESC
    `
  );

  return result.rows.map((row) => ({
    ...mapQuoteSummary(row),
    userId: row.user_id,
    customerEmail: row.customer_email,
    companyName: row.company_name ?? "",
    contactName: row.contact_name ?? "",
  })) satisfies AdminQuoteSummary[];
}

export async function getQuoteForAdmin(quoteId: number) {
  const result = await query<
    QuoteRow & {
      customer_email: string;
      company_name: string | null;
      contact_name: string | null;
    }
  >(
    `
      SELECT
        q.id,
        q.user_id,
        q.quote_name,
        q.items,
        q.total_amount,
        COALESCE(q.admin_discount_percent, 0)::text AS admin_discount_percent,
        q.status,
        q.created_at,
        q.updated_at,
        u.email AS customer_email,
        u.company_name,
        u.contact_name
      FROM quotes q
      JOIN users u ON u.id = q.user_id
      WHERE q.id = $1
    `,
    [quoteId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...mapQuoteDetail(row),
    customerEmail: row.customer_email,
    companyName: row.company_name ?? "",
    contactName: row.contact_name ?? "",
  } satisfies AdminQuoteDetail;
}

export function parseOptionalSourceQuoteId(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function getQuoteAdminDiscountForUser(quoteId: number, userId: number) {
  const result = await query<{ admin_discount_percent: string }>(
    `
      SELECT COALESCE(admin_discount_percent, 0)::text AS admin_discount_percent
      FROM quotes
      WHERE id = $1 AND user_id = $2
    `,
    [quoteId, userId]
  );

  return Number.parseFloat(result.rows[0]?.admin_discount_percent ?? "0") || 0;
}

export async function setQuoteAdminDiscount(params: {
  quoteId: number;
  adminUserId: number;
  discountPercent: number;
}) {
  const existing = await getQuoteForAdmin(params.quoteId);

  if (!existing) {
    return null;
  }

  const result = await query<
    QuoteRow & {
      customer_email: string;
      company_name: string | null;
      contact_name: string | null;
      admin_email: string;
    }
  >(
    `
      UPDATE quotes q
      SET
        admin_discount_percent = $2,
        updated_at = NOW()
      FROM users dealer, users admin_user
      WHERE q.id = $1
        AND dealer.id = q.user_id
        AND admin_user.id = $3
      RETURNING
        q.id,
        q.user_id,
        q.quote_name,
        q.items,
        q.total_amount,
        COALESCE(q.admin_discount_percent, 0)::text AS admin_discount_percent,
        q.status,
        q.created_at,
        q.updated_at,
        dealer.email AS customer_email,
        dealer.company_name,
        dealer.contact_name,
        admin_user.email AS admin_email
    `,
    [params.quoteId, params.discountPercent, params.adminUserId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const quote = {
    ...mapQuoteDetail(row),
    customerEmail: row.customer_email,
    companyName: row.company_name ?? "",
    contactName: row.contact_name ?? "",
  } satisfies AdminQuoteDetail;

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "quotes",
    recordId: quote.id,
    oldValues: {
      quote_name: existing.quoteName,
      admin_discount_percent: existing.adminDiscountPercent,
      total_amount: existing.totalAmount,
    },
    newValues: {
      event: "admin_discount",
      quote_name: quote.quoteName,
      customer_email: quote.customerEmail,
      admin_discount_percent: quote.adminDiscountPercent,
      total_amount: quote.totalAmount,
      display_total_amount: quote.displayTotalAmount,
      summary:
        quote.adminDiscountPercent > 0
          ? `${row.admin_email} applied a ${quote.adminDiscountPercent}% special discount on quote "${quote.quoteName}" for ${quote.customerEmail}.`
          : `${row.admin_email} removed the special discount on quote "${quote.quoteName}" for ${quote.customerEmail}.`,
    },
  });

  return quote;
}

export async function logQuoteAdminView(params: {
  adminUserId: number;
  quoteId: number;
  quoteName: string;
  customerEmail: string;
}) {
  await query(
    `
      INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values
      )
      VALUES ($1, 'UPDATE', 'quotes', $2, NULL, $3::jsonb)
    `,
    [
      params.adminUserId,
      params.quoteId,
      JSON.stringify({
        event: "admin_view",
        quote_name: params.quoteName,
        customer_email: params.customerEmail,
      }),
    ]
  );
}

export async function logQuoteCreated(params: {
  userId: number;
  quoteId: number;
  quoteName: string;
  totalAmount: number;
  itemCount: number;
}) {
  await query(
    `
      INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values
      )
      VALUES ($1, 'CREATE', 'quotes', $2, NULL, $3::jsonb)
    `,
    [
      params.userId,
      params.quoteId,
      JSON.stringify({
        quote_name: params.quoteName,
        total_amount: params.totalAmount,
        item_count: params.itemCount,
      }),
    ]
  );
}

async function logQuoteArchiveChange(params: {
  userId: number;
  quoteId: number;
  quoteName: string;
  event: "archive" | "restore" | "ordered";
}) {
  await query(
    `
      INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values
      )
      VALUES ($1, 'UPDATE', 'quotes', $2, NULL, $3::jsonb)
    `,
    [
      params.userId,
      params.quoteId,
      JSON.stringify({
        event: params.event,
        quote_name: params.quoteName,
      }),
    ]
  );
}

export async function setQuoteArchivedForUser(params: {
  quoteId: number;
  userId: number;
  archived: boolean;
}) {
  const quote = await getQuoteForUser(params.quoteId, params.userId);

  if (!quote) {
    return null;
  }

  const alreadyArchived = isArchivedQuoteStatus(quote.status);

  if (params.archived === alreadyArchived) {
    return quote;
  }

  const nextStatus = params.archived ? "archived" : "draft";
  const result = await query<QuoteRow>(
    `
      UPDATE quotes
      SET status = $3, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING ${QUOTE_SELECT}
    `,
    [params.quoteId, params.userId, nextStatus]
  );

  const updated = result.rows[0] ? mapQuoteDetail(result.rows[0]) : null;

  if (updated) {
    await logQuoteArchiveChange({
      userId: params.userId,
      quoteId: updated.id,
      quoteName: updated.quoteName,
      event: params.archived ? "archive" : "restore",
    });
  }

  return updated;
}

export async function archiveMatchingQuotesForOrder(params: {
  userId: number;
  items: Array<{ id: string; quantity: number }>;
  sourceQuoteId?: number | null;
}) {
  const result = await query<QuoteRow>(
    `
      SELECT ${QUOTE_SELECT}
      FROM quotes
      WHERE user_id = $1
        AND status <> 'archived'
    `,
    [params.userId]
  );

  if (result.rows.length === 0) {
    return [];
  }

  const orderFingerprint = quoteItemsFingerprint(params.items);
  const sourceQuoteId =
    params.sourceQuoteId && Number.isInteger(params.sourceQuoteId) && params.sourceQuoteId > 0
      ? params.sourceQuoteId
      : null;

  const toArchive = result.rows.filter((row) => {
    if (sourceQuoteId && row.id === sourceQuoteId) {
      return true;
    }

    return quoteItemsFingerprint(parseQuoteItems(row.items)) === orderFingerprint;
  });

  if (toArchive.length === 0) {
    return [];
  }

  const ids = toArchive.map((row) => row.id);
  const archived = await query<QuoteRow>(
    `
      UPDATE quotes
      SET status = 'archived', updated_at = NOW()
      WHERE user_id = $1
        AND status <> 'archived'
        AND id = ANY($2::int[])
      RETURNING ${QUOTE_SELECT}
    `,
    [params.userId, ids]
  );

  await Promise.all(
    archived.rows.map((row) =>
      logQuoteArchiveChange({
        userId: params.userId,
        quoteId: row.id,
        quoteName: row.quote_name,
        event: "ordered",
      })
    )
  );

  return archived.rows.map(mapQuoteSummary);
}
