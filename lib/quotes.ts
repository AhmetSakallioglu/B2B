import { query } from "@/lib/db";
import type { OrderCartItem } from "@/types/catalog";
import type {
  AdminQuoteDetail,
  AdminQuoteSummary,
  QuoteDetail,
  QuoteRow,
  QuoteSummary,
} from "@/types/quotes";

function parseQuoteItems(value: unknown): OrderCartItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value as OrderCartItem[];
}

function mapQuoteSummary(row: QuoteRow): QuoteSummary {
  const items = parseQuoteItems(row.items);

  return {
    id: row.id,
    quoteName: row.quote_name,
    totalAmount: Number.parseFloat(row.total_amount),
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
      RETURNING
        id,
        user_id,
        quote_name,
        items,
        total_amount,
        status,
        created_at,
        updated_at
    `,
    [params.userId, params.quoteName, JSON.stringify(params.items), params.totalAmount]
  );

  return mapQuoteDetail(result.rows[0]);
}

export async function listQuotesForUser(userId: number) {
  const result = await query<QuoteRow>(
    `
      SELECT
        id,
        user_id,
        quote_name,
        items,
        total_amount,
        status,
        created_at,
        updated_at
      FROM quotes
      WHERE user_id = $1
      ORDER BY updated_at DESC, id DESC
    `,
    [userId]
  );

  return result.rows.map(mapQuoteSummary);
}

export async function getQuoteForUser(quoteId: number, userId: number) {
  const result = await query<QuoteRow>(
    `
      SELECT
        id,
        user_id,
        quote_name,
        items,
        total_amount,
        status,
        created_at,
        updated_at
      FROM quotes
      WHERE id = $1 AND user_id = $2
    `,
    [quoteId, userId]
  );

  const row = result.rows[0];
  return row ? mapQuoteDetail(row) : null;
}

export async function listQuotesForAdmin() {
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
        q.status,
        q.created_at,
        q.updated_at,
        u.email AS customer_email,
        u.company_name,
        u.contact_name
      FROM quotes q
      JOIN users u ON u.id = q.user_id
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
