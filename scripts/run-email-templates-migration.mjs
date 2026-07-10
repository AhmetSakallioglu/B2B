import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:5454@localhost:5432/cabinet_project",
});

const DEFAULT_TEMPLATES = [
  {
    name: "Template 1 - Initial Reminder",
    subject: "Complete Your Cabinet Project",
    body_html: `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Hi {{customer_name}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">You left a cabinet project in your cart. Your selections are saved and ready whenever you want to finish checkout.</p>
{{cart_items_table}}
<p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#64748b;">Need to adjust quantities or add another run? You can update everything from your cart before placing the order.</p>`,
    automation_stage: 1,
    cta_label: "Go to Cart",
    cta_href: "{{cart_url}}",
    sort_order: 1,
  },
  {
    name: "Template 2 - Design Support",
    subject: "Need Help with Your Layout/Design?",
    body_html: `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Hi {{customer_name}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">We noticed your cabinet project is still open. If you need help with layout, finish selection, or sizing, our team can walk through the project with you.</p>
<div style="margin:20px 0;padding:18px 20px;border-radius:14px;background:#f5f0e6;border:1px solid #e2e8f0;">
  <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1c3a4a;">Design &amp; project support</p>
  <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">Email us at <a href="mailto:{{company_email}}" style="color:#b8611a;font-weight:700;text-decoration:none;">{{company_email}}</a> or call <strong>{{company_phone}}</strong>.</p>
</div>
<p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">You can also save the project as a quote and share notes with our design team before ordering.</p>`,
    automation_stage: 2,
    cta_label: "Review Saved Project",
    cta_href: "{{quotes_url}}",
    sort_order: 2,
  },
  {
    name: "Template 3 - Closing Offer",
    subject: "Special Offer to Close Your Project",
    body_html: `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Hi {{customer_name}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">We would love to help you close out this project. For a limited time, use the offer below when you return to checkout.</p>
<div style="margin:20px 0;padding:22px 20px;border-radius:14px;background:#f5f0e6;border:1px dashed #b8611a;text-align:center;">
  <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;font-weight:700;">Limited project offer</p>
  <p style="margin:0;font-size:28px;font-weight:800;color:#b8611a;">{{offer_percent}}% off</p>
  <p style="margin:8px 0 0;font-size:14px;color:#1c3a4a;">Use your personal code <strong>{{discount_code}}</strong> at checkout</p>
  <p style="margin:8px 0 0;font-size:12px;color:#64748b;">Valid until {{discount_expiry}}</p>
</div>
{{cart_items_table}}`,
    automation_stage: 3,
    cta_label: "Apply Discount & Order Now",
    cta_href: "{{cart_url}}",
    sort_order: 3,
  },
];

try {
  const sql = readFileSync(join(process.cwd(), "db/email-templates-migration.sql"), "utf8");
  await pool.query(sql);

  const existing = await pool.query(`SELECT COUNT(*)::text AS count FROM email_templates`);
  const count = Number.parseInt(existing.rows[0]?.count ?? "0", 10);

  if (count === 0) {
    for (const template of DEFAULT_TEMPLATES) {
      await pool.query(
        `
          INSERT INTO email_templates (
            name,
            subject,
            body_html,
            is_system_default,
            automation_stage,
            cta_label,
            cta_href,
            sort_order
          )
          VALUES ($1, $2, $3, true, $4, $5, $6, $7)
        `,
        [
          template.name,
          template.subject,
          template.body_html,
          template.automation_stage,
          template.cta_label,
          template.cta_href,
          template.sort_order,
        ]
      );
    }
  }

  console.log("Email templates migration completed.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Email templates migration failed:", message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
