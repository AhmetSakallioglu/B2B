import { sendEmail } from "@/lib/email/send-email";
import { getCompanyProfile } from "@/lib/company-profile";

export async function sendTaxExemptionDecisionEmail(params: {
  email: string;
  companyName: string | null;
  contactName: string | null;
  decision: "approve" | "reject";
  rejectionReason?: string | null;
}) {
  const company = getCompanyProfile();
  const dealerName = params.contactName?.trim() || params.companyName?.trim() || "Dealer";
  const brandName = company.name || "Cabinetto Pro";

  if (params.decision === "approve") {
    return sendEmail({
      to: params.email,
      subject: `${brandName}: Texas resale certificate approved`,
      html: `
        <p>Hello ${dealerName},</p>
        <p>Your Texas resale / tax exemption certificate has been approved.</p>
        <p>Sales tax will no longer be applied to your orders on ${brandName}.</p>
        <p>Thank you,<br />${brandName}</p>
      `,
    });
  }

  const reason = params.rejectionReason?.trim() || "The submitted document could not be verified.";

  return sendEmail({
    to: params.email,
    subject: `${brandName}: Texas resale certificate review update`,
    html: `
      <p>Hello ${dealerName},</p>
      <p>Your Texas resale / tax exemption certificate was reviewed and could not be approved at this time.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>You may upload an updated certificate from your account settings. Sales tax will continue to apply until approval.</p>
      <p>Thank you,<br />${brandName}</p>
    `,
  });
}
