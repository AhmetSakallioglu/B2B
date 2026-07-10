"use client";

import Link from "next/link";
import { useState } from "react";
import { CabinettoBrand } from "@/components/brand/CabinettoBrand";
import { useLogoutConfirm } from "@/components/auth/LogoutConfirmProvider";
import { useSession } from "@/components/auth/SessionProvider";
import {
  LayoutDashboardIcon,
  LogInIcon,
  LogOutIcon,
  PackageIcon,
  ShoppingCartIcon,
  UserIcon,
  UserPlusIcon,
} from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useCartPersistence } from "@/hooks/useCartPersistence";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { useCartStore } from "@/store/useCartStore";
import { ui } from "@/lib/ui-classes";

type CatalogSiteHeaderProps = {
  subtitle?: string;
};

function HeaderAuthSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <LoadingSpinner size="sm" />
      <span className="hidden text-sm text-muted sm:inline dark:text-cream/70">Loading...</span>
    </div>
  );
}

export function CatalogSiteHeader({
  subtitle = "Modular Cabinet Catalog",
}: CatalogSiteHeaderProps) {
  const { user, isLoading: sessionLoading } = useSession();
  const { requestLogout } = useLogoutConfirm();
  const isAdmin = user?.role === "admin";
  const isCartReady = useCartStore((state) => state.isHydrated);
  const totalItems = useCartStore((state) => state.totalItems());
  const lastFeedback = useCartStore((state) => state.lastFeedback);
  const [cartBadgePulse, setCartBadgePulse] = useState(false);

  useCartPersistence(user, isAdmin, sessionLoading);

  useDeferredEffect(() => {
    if (!lastFeedback || lastFeedback.type !== "add" || isAdmin) {
      return;
    }

    setCartBadgePulse(true);
    const timer = setTimeout(() => setCartBadgePulse(false), 600);
    return () => clearTimeout(timer);
  }, [lastFeedback?.at, isAdmin]);

  const handleLogout = async () => {
    await requestLogout();
  };

  const showAuthSkeleton = sessionLoading;
  const showCartSkeleton = sessionLoading || !isCartReady;

  return (
    <header className={`sticky top-0 z-20 ${ui.adminHeaderBar}`}>
      <div className={`${ui.pageContainer} flex max-w-[1600px] items-center justify-between py-4`}>
        <div>
          <CabinettoBrand subtitle={subtitle} />
        </div>
        <div className="flex items-center gap-3">
          {showAuthSkeleton ? (
            <HeaderAuthSkeleton />
          ) : user ? (
            <>
              <span className={`hidden text-sm sm:inline ${ui.bodyMuted}`}>
                {user.email}
              </span>
              {user.role !== "admin" && (
                <>
                  <Link href="/account" className={`hidden sm:inline-flex ${ui.btnSecondary} px-3 py-1.5 text-sm`}>
                    <IconLabel icon={<UserIcon size={15} />}>My Account</IconLabel>
                  </Link>
                  <Link href="/orders" className={`${ui.btnSecondary} px-3 py-1.5 text-sm`}>
                    <IconLabel icon={<PackageIcon size={15} />}>My Orders</IconLabel>
                  </Link>
                </>
              )}
              {user.role === "admin" && (
                <Link href="/admin" className={`${ui.btnSecondary} px-3 py-1.5 text-sm`}>
                  <IconLabel icon={<LayoutDashboardIcon size={15} />}>Admin Panel</IconLabel>
                </Link>
              )}
              <button type="button" onClick={handleLogout} className={`${ui.btnSecondary} px-3 py-1.5 text-sm`}>
                <IconLabel icon={<LogOutIcon size={15} />}>Logout</IconLabel>
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={`${ui.btnSecondary} px-3 py-1.5 text-sm`}>
                <IconLabel icon={<LogInIcon size={15} />}>Login</IconLabel>
              </Link>
              <Link
                href="/register"
                className={`hidden sm:inline-flex ${ui.btnPrimary} px-3 py-1.5 text-sm`}
              >
                <IconLabel icon={<UserPlusIcon size={15} />}>Register</IconLabel>
              </Link>
            </>
          )}
          {!isAdmin && user && (
            <Link
              href="/cart"
              className={`inline-flex items-center gap-2.5 ${ui.btnSecondary} px-4 py-2 shadow-soft`}
            >
              <ShoppingCartIcon size={18} className="text-brand" />
              <span className="hidden text-sm text-muted sm:inline dark:text-cream/70">Cart</span>
              <span
                className={`flex h-7 min-w-7 items-center justify-center rounded-full bg-brand px-2 text-sm font-semibold text-white ${
                  cartBadgePulse ? "animate-cart-bounce" : ""
                }`}
              >
                {showCartSkeleton ? (
                  <LoadingSpinner size="sm" variant="light" />
                ) : (
                  totalItems
                )}
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
