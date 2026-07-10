"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { RecaptchaV3Script } from "@/components/auth/RecaptchaV3Script";
import { LockIcon, LogInIcon, MailIcon, UserPlusIcon } from "@/components/ui/Icon";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { LoadingState } from "@/components/ui/LoadingState";
import { ui } from "@/lib/ui-classes";
import { sanitizeRedirectUrl } from "@/lib/security-utils";
import type { AuthErrorCode, LoginErrorResponse, SessionUser } from "@/types/auth";

function isSessionUser(value: {
  id: number;
  email: string;
  role: string;
}): value is SessionUser {
  return value.role === "customer" || value.role === "admin";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useSession();
  const redirectTo = sanitizeRedirectUrl(searchParams.get("redirect"));
  const registered = searchParams.get("registered") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setErrorCode(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as LoginErrorResponse & {
        user?: { id: number; email: string; role: string };
      };

      if (!response.ok) {
        setErrorCode(data.code ?? null);
        throw new Error(data.error ?? "Login failed");
      }

      if (data.user && isSessionUser(data.user)) {
        setUser(data.user);
      }

      router.push(redirectTo);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Login failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`flex min-h-full items-center justify-center px-4 py-12 ${ui.catalogPageBg}`}>
      <div className={`w-full max-w-md p-8 ${ui.adminCard}`}>
        <p className={ui.eyebrow}>Cabinetto Pro</p>
        <h1 className={`mt-2 flex items-center gap-2 ${ui.heading1}`}>
          <LogInIcon size={24} className="text-brand" />
          Sign in
        </h1>
        <p className={`mt-2 ${ui.bodyMuted}`}>
          Access your account to place cabinet orders.
        </p>

        {registered && (
          <p className="mt-6 rounded-xl border border-brand/20 bg-brand-light px-4 py-3 text-sm text-navy dark:text-cream">
            Registration received. Your account is pending administrator approval. You can sign in
            once it has been activated.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-medium text-navy/90 dark:text-cream/90">
              <MailIcon size={15} className="text-brand" />
              Email
            </span>
            <input
              type="email"
              required
              disabled={isSubmitting}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={ui.input}
              placeholder="you@example.com"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-medium text-navy/90 dark:text-cream/90">
              <LockIcon size={15} className="text-brand" />
              Password
            </span>
            <input
              type="password"
              required
              disabled={isSubmitting}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={ui.input}
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p
              className={`rounded-xl px-4 py-3 text-sm ${
                errorCode === "ACCOUNT_PENDING"
                  ? "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
                  : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
              }`}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`${ui.btnPrimary} w-full py-3`}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" variant="light" />
                Signing in...
              </>
            ) : (
              <>
                <LogInIcon size={16} />
                Sign in
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted dark:text-cream/75">
          No account yet?{" "}
          <Link
            href={`/register?redirect=${encodeURIComponent(redirectTo)}`}
            className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-brand-hover dark:text-brand"
          >
            <UserPlusIcon size={15} />
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <RecaptchaV3Script />
      <Suspense
        fallback={<LoadingState fullScreen label="Loading sign in..." spinnerSize="lg" />}
      >
        <LoginForm />
      </Suspense>
    </>
  );
}
