import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { query } from "@/lib/db";
import { rejectPrivilegeEscalationAttempt } from "@/lib/privilege-escalation-guard";
import { enforceMutationSecurity } from "@/lib/request-security";
import {
  AUTH_BACKOFF_SCOPES,
  recordExponentialBackoffFailure,
} from "@/lib/exponential-backoff-limit";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { databaseSetupHint } from "@/lib/db-setup-hints";
import type { UserRole } from "@/types/auth";
import type { AccountStatus } from "@/lib/user-approval";

export const runtime = "nodejs";

type UserRow = {
  id: number;
  email: string;
  role: UserRole;
  account_status: AccountStatus;
};

async function readRegistrationRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payload = formData.get("payload");
    const taxDocumentEntry = formData.get("taxDocument");

    if (typeof payload !== "string") {
      return { body: null, taxDocumentFile: null, error: "Invalid application payload" as const };
    }

    let body: unknown;

    try {
      body = JSON.parse(payload);
    } catch {
      return { body: null, taxDocumentFile: null, error: "Invalid application payload" as const };
    }

    const taxDocumentFile =
      taxDocumentEntry instanceof File && taxDocumentEntry.size > 0 ? taxDocumentEntry : null;

    return { body, taxDocumentFile, error: null };
  }

  try {
    const body = await request.json();
    return { body, taxDocumentFile: null, error: null };
  } catch {
    return { body: null, taxDocumentFile: null, error: "Invalid application payload" as const };
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(request: Request) {
  const mutationBlocked = enforceMutationSecurity(request);

  if (mutationBlocked) {
    return mutationBlocked;
  }

  try {
    const { parseDealerApplicationBody } = await import("@/lib/dealer-application");
    const { verifyRecaptchaToken, getRecaptchaErrorMessage } = await import("@/lib/recaptcha");
    const { saveTaxDocument } = await import("@/lib/save-tax-document");
    const {
      REGISTRATION_PENDING_MESSAGE,
      REGISTRATION_TAX_CERTIFICATE_PENDING_NOTE,
    } = await import("@/lib/user-approval");

    const { body, taxDocumentFile, error: readError } = await readRegistrationRequest(request);

    if (readError || !body) {
      await recordExponentialBackoffFailure(
        AUTH_BACKOFF_SCOPES.register,
        getClientIpFromRequest(request)
      );

      return NextResponse.json({ error: readError ?? "Invalid application payload" }, { status: 400 });
    }

    const privilegeBlocked = await rejectPrivilegeEscalationAttempt(request, body, {
      route: "/api/auth/register",
      source: "registration",
    });

    if (privilegeBlocked) {
      return privilegeBlocked;
    }

    const parsed = parseDealerApplicationBody(body, {
      taxDocumentProvided: Boolean(taxDocumentFile),
    });

    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const recaptchaToken =
      body && typeof body === "object" && typeof body.recaptchaToken === "string"
        ? body.recaptchaToken
        : null;

    const recaptchaResult = await verifyRecaptchaToken(recaptchaToken);

    if (!recaptchaResult.ok) {
      return NextResponse.json(
        { error: getRecaptchaErrorMessage(recaptchaResult) },
        { status: 400 }
      );
    }

    const application = parsed.data;

    const existing = await query<{ id: number; account_status: AccountStatus }>(
      "SELECT id, account_status FROM users WHERE email = $1",
      [application.email]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        {
          pendingApproval: true,
          message: REGISTRATION_PENDING_MESSAGE,
          email: application.email,
        },
        { status: 201 }
      );
    }

    if (application.taxStatus === "exempt" && taxDocumentFile) {
      try {
        application.taxDocumentUrl = await saveTaxDocument(taxDocumentFile);
      } catch (uploadError) {
        return NextResponse.json(
          {
            error:
              uploadError instanceof Error
                ? uploadError.message
                : "Failed to upload tax document",
          },
          { status: 400 }
        );
      }
    }

    const certificateUrl = application.taxDocumentUrl ?? null;
    const taxExemptionStatus = certificateUrl ? "PENDING" : "NONE";
    const isTaxExempt = application.taxStatus === "exempt";

    const passwordHash = await hashPassword(application.password);

    const result = await query<UserRow>(
      `
        INSERT INTO users (
          email,
          password_hash,
          role,
          account_status,
          company_name,
          contact_name,
          phone,
          alternate_phone,
          fax,
          billing_first_name,
          billing_last_name,
          billing_phone,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          shipping_same_as_billing,
          shipping_first_name,
          shipping_last_name,
          shipping_address_line1,
          shipping_address_line2,
          shipping_city,
          shipping_state,
          shipping_postal_code,
          shipping_country,
          shipping_phone,
          federal_tax_id,
          application_notes,
          tax_status,
          is_tax_exempt,
          tax_exemption_status,
          business_type,
          expected_monthly_sales,
          sales_tax_account,
          has_resale_license,
          resale_license_number,
          tax_document_url,
          resale_certificate_url
        )
        VALUES (
          $1, $2, 'customer', 'pending',
          $3, $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13, $14, $15, $16,
          $17,
          $18, $19, $20, $21, $22, $23, $24, $25, $26,
          $27, $28,
          $29, $30, $31,
          $32, $33, $34, $35, $36, $37, $37
        )
        RETURNING id, email, role, account_status
      `,
      [
        application.email,
        passwordHash,
        application.companyName,
        application.contactName,
        application.phone,
        application.alternatePhone,
        application.fax,
        application.billingFirstName,
        application.billingLastName,
        application.billingPhone,
        application.addressLine1,
        application.addressLine2,
        application.city,
        application.state,
        application.postalCode,
        application.country,
        application.shippingSameAsBilling,
        application.shippingFirstName,
        application.shippingLastName,
        application.shippingAddressLine1,
        application.shippingAddressLine2,
        application.shippingCity,
        application.shippingState,
        application.shippingPostalCode,
        application.shippingCountry,
        application.shippingPhone,
        application.federalTaxId,
        application.applicationNotes,
        application.taxStatus,
        isTaxExempt,
        taxExemptionStatus,
        application.businessType,
        application.expectedMonthlySales,
        application.salesTaxAccount,
        application.hasResaleLicense,
        application.resaleLicenseNumber,
        certificateUrl,
      ]
    );

    const user = result.rows[0];
    const registrationMessage = certificateUrl
      ? `${REGISTRATION_PENDING_MESSAGE} ${REGISTRATION_TAX_CERTIFICATE_PENDING_NOTE}`
      : REGISTRATION_PENDING_MESSAGE;

    const { notifyAdminsNewDealerApplication } = await import("@/lib/web-push/triggers");
    notifyAdminsNewDealerApplication({ companyName: application.companyName });

    return NextResponse.json(
      {
        pendingApproval: true,
        message: registrationMessage,
        email: user.email,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/auth/register failed:", error);
    const hint = databaseSetupHint(error);
    const message =
      error instanceof Error && error.message
        ? `Registration failed: ${error.message}${hint}`
        : `Registration failed.${hint}`;

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
