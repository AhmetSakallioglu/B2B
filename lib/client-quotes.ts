import { saveStoredFile } from "@/lib/object-storage";
import { query } from "@/lib/db";
import {
  parseClientQuoteStoredItems,
  serializeClientQuoteItems,
} from "@/lib/client-quote-storage";
import type { PoolClient } from "pg";
import type {
  AdminClientQuoteSummary,
  ClientQuoteBranding,
  ClientQuoteDetail,
  ClientQuotePricingResult,
  ClientQuoteRow,
  ClientQuoteStatus,
  ClientQuoteSummary,
} from "@/types/client-quotes";

type QueryExecutor = Pick<PoolClient, "query">;

function mapQuoteSummary(row: ClientQuoteRow): ClientQuoteSummary {
  const items = parseClientQuoteStoredItems(row.items);

  return {
    id: row.id,
    clientName: row.client_name,
    clientEmail: row.client_email,
    totalAmount: Number(row.total_amount),
    status: row.status,
    pdfUrl: row.pdf_url,
    createdAt: row.created_at,
    itemCount: items.length,
  };
}

function mapQuoteDetail(row: ClientQuoteRow): ClientQuoteDetail {
  const summary = mapQuoteSummary(row);
  const items = parseClientQuoteStoredItems(row.items);

  return {
    ...summary,
    items,
    markupPercentage: Number(row.markup_percentage),
    includeTax: row.include_tax,
    includeShipping: row.include_shipping,
    clientSubtotal: Number(row.client_subtotal),
    taxAmount: Number(row.tax_amount),
    shippingAmount: Number(row.shipping_amount),
  };
}

export async function fetchClientQuoteBranding(userId: number): Promise<ClientQuoteBranding | null> {
  const result = await query<{
    email: string;
    company_name: string | null;
    contact_name: string | null;
    phone: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    company_logo_url: string | null;
    custom_quote_footer_text: string | null;
  }>(
    `
      SELECT
        email,
        company_name,
        contact_name,
        phone,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        company_logo_url,
        custom_quote_footer_text
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    companyName: row.company_name ?? "",
    contactName: row.contact_name ?? "",
    phone: row.phone ?? "",
    email: row.email,
    addressLine1: row.address_line1 ?? "",
    addressLine2: row.address_line2 ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    postalCode: row.postal_code ?? "",
    companyLogoUrl: row.company_logo_url,
    customQuoteFooterText: row.custom_quote_footer_text,
  };
}

export async function saveClientQuotePdf(buffer: Buffer) {
  return saveStoredFile({
    category: "client-quotes",
    buffer,
    extension: "pdf",
    contentType: "application/pdf",
  });
}

export async function insertClientQuoteRecord(
  params: {
    userId: number;
    clientName: string;
    clientEmail: string | null;
    pricing: ClientQuotePricingResult;
    pdfUrl: string | null;
    status?: ClientQuoteStatus;
  },
  client?: QueryExecutor
) {
  const runQuery = client?.query.bind(client) ?? query;
  const storedItems = serializeClientQuoteItems(params.pricing.items);

  const result = await runQuery<{ id: number; created_at: Date }>(
    `
      INSERT INTO client_quotes (
        user_id,
        client_name,
        client_email,
        markup_percentage,
        include_tax,
        include_shipping,
        items,
        msrp_subtotal,
        client_subtotal,
        tax_amount,
        shipping_amount,
        total_amount,
        pdf_url,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, created_at
    `,
    [
      params.userId,
      params.clientName,
      params.clientEmail,
      params.pricing.markupPercentage,
      params.pricing.includeTax,
      params.pricing.includeShipping,
      JSON.stringify(storedItems),
      params.pricing.dealerNetSubtotal,
      params.pricing.clientSubtotal,
      params.pricing.taxAmount,
      params.pricing.shippingAmount,
      params.pricing.totalAmount,
      params.pdfUrl,
      params.status ?? "PENDING",
    ]
  );

  return result.rows[0];
}

export async function updateClientQuotePdfUrl(
  quoteId: number,
  pdfUrl: string,
  client?: QueryExecutor
) {
  const runQuery = client?.query.bind(client) ?? query;

  await runQuery(
    `
      UPDATE client_quotes
      SET pdf_url = $2
      WHERE id = $1
    `,
    [quoteId, pdfUrl]
  );
}

export async function listClientQuotesForUser(userId: number): Promise<ClientQuoteSummary[]> {
  const result = await query<ClientQuoteRow>(
    `
      SELECT
        id,
        user_id,
        client_name,
        client_email,
        markup_percentage,
        include_tax,
        include_shipping,
        items,
        msrp_subtotal,
        client_subtotal,
        tax_amount,
        shipping_amount,
        total_amount,
        pdf_url,
        status,
        created_at
      FROM client_quotes
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  return result.rows.map(mapQuoteSummary);
}

export async function getClientQuoteForUser(
  quoteId: number,
  userId: number
): Promise<ClientQuoteDetail | null> {
  const result = await query<ClientQuoteRow>(
    `
      SELECT
        id,
        user_id,
        client_name,
        client_email,
        markup_percentage,
        include_tax,
        include_shipping,
        items,
        msrp_subtotal,
        client_subtotal,
        tax_amount,
        shipping_amount,
        total_amount,
        pdf_url,
        status,
        created_at
      FROM client_quotes
      WHERE id = $1 AND user_id = $2
    `,
    [quoteId, userId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return mapQuoteDetail(row);
}

export async function markClientQuoteConverted(quoteId: number, userId: number) {
  await query(
    `
      UPDATE client_quotes
      SET status = 'CONVERTED'
      WHERE id = $1 AND user_id = $2 AND status = 'PENDING'
    `,
    [quoteId, userId]
  );
}

export async function listAllClientQuotesForAdmin(): Promise<AdminClientQuoteSummary[]> {
  const result = await query<
    ClientQuoteRow & {
      company_name: string | null;
      contact_name: string | null;
      email: string;
    }
  >(
    `
      SELECT
        cq.id,
        cq.user_id,
        cq.client_name,
        cq.client_email,
        cq.markup_percentage,
        cq.include_tax,
        cq.include_shipping,
        cq.items,
        cq.msrp_subtotal,
        cq.client_subtotal,
        cq.tax_amount,
        cq.shipping_amount,
        cq.total_amount,
        cq.pdf_url,
        cq.status,
        cq.created_at,
        u.company_name,
        u.contact_name,
        u.email
      FROM client_quotes cq
      INNER JOIN users u ON u.id = cq.user_id
      ORDER BY cq.created_at DESC
    `
  );

  return result.rows.map((row) => ({
    ...mapQuoteSummary(row),
    userId: row.user_id,
    dealerCompanyName: row.company_name,
    dealerContactName: row.contact_name,
    dealerEmail: row.email,
  }));
}

export async function updateDealerQuoteBranding(
  userId: number,
  params: {
    companyLogoUrl?: string | null;
    customQuoteFooterText?: string | null;
  },
  client?: QueryExecutor
) {
  const runQuery = client?.query.bind(client) ?? query;
  const updates: string[] = [];
  const values: unknown[] = [userId];
  let index = 2;

  if (params.companyLogoUrl !== undefined) {
    updates.push(`company_logo_url = $${index}`);
    values.push(params.companyLogoUrl);
    index += 1;
  }

  if (params.customQuoteFooterText !== undefined) {
    updates.push(`custom_quote_footer_text = $${index}`);
    values.push(params.customQuoteFooterText);
    index += 1;
  }

  if (updates.length === 0) {
    return;
  }

  updates.push("updated_at = NOW()");

  await runQuery(
    `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $1
    `,
    values
  );
}
