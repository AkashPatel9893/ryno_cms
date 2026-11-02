"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => {
    const clear = () => client.clear();
    window.addEventListener("ryno:admin_session_cleared", clear);
    return () =>
      window.removeEventListener("ryno:admin_session_cleared", clear);
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
