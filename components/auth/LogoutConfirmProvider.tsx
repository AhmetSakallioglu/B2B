"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSession } from "@/components/auth/SessionProvider";

type LogoutConfirmContextValue = {
  requestLogout: () => Promise<boolean>;
};

const LogoutConfirmContext = createContext<LogoutConfirmContextValue | null>(null);

export function LogoutConfirmProvider({ children }: { children: ReactNode }) {
  const { setUser } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const finish = useCallback((confirmed: boolean) => {
    setOpen(false);
    setLoading(false);
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
  }, []);

  const requestLogout = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpen(true);
      setLoading(false);
    });
  }, []);

  const handleConfirm = async () => {
    setLoading(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      finish(true);
    } catch {
      finish(false);
    }
  };

  const handleCancel = () => {
    if (loading) {
      return;
    }

    finish(false);
  };

  return (
    <LogoutConfirmContext.Provider value={{ requestLogout }}>
      {children}
      <ConfirmDialog
        open={open}
        title="Log out?"
        description="You will need to sign in again to access your account, cart, and orders."
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </LogoutConfirmContext.Provider>
  );
}

export function useLogoutConfirm() {
  const context = useContext(LogoutConfirmContext);

  if (!context) {
    throw new Error("useLogoutConfirm must be used within LogoutConfirmProvider");
  }

  return context;
}
