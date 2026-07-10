"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import type { ImpersonationContext, SessionUser } from "@/types/auth";

type SessionContextValue = {
  user: SessionUser | null;
  impersonation: ImpersonationContext | null;
  isLoading: boolean;
  setUser: (user: SessionUser | null) => void;
  refreshSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonationContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me");

      if (!response.ok) {
        setUser(null);
        setImpersonation(null);
        return;
      }

      const data = (await response.json()) as {
        user: SessionUser;
        impersonation?: ImpersonationContext | null;
      };
      setUser(data.user);
      setImpersonation(data.impersonation ?? null);
    } catch {
      setUser(null);
      setImpersonation(null);
    }
  }, []);

  useDeferredEffect(() => {
    let cancelled = false;

    void refreshSession().finally(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;

    const leftAuthPage =
      (previousPathname === "/login" || previousPathname === "/register") &&
      pathname !== previousPathname;

    if (leftAuthPage) {
      void refreshSession();
    }
  }, [pathname, refreshSession]);

  return (
    <SessionContext.Provider
      value={{ user, impersonation, isLoading, setUser, refreshSession }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }

  return context;
}
