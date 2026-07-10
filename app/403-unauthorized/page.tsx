import Link from "next/link";
import { ui } from "@/lib/ui-classes";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">403</p>
      <h1 className={`mt-3 ${ui.heading1}`}>Access denied</h1>
      <p className={`mt-4 ${ui.bodyMuted}`}>
        You do not have permission to view this page. Admin areas require an approved administrator
        account.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/catalog" className={ui.btnPrimary}>
          Go to catalog
        </Link>
        <Link href="/login" className={ui.btnSecondary}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
