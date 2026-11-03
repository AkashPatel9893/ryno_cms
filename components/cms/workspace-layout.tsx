"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Workspace from "@/components/cms/workspace";
import { sections } from "@/components/cms/navigation";

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const verificationPage = /^\/partners\/drivers\/[^/]+\/verification\/?$/.test(
    pathname,
  );
  const section = verificationPage
    ? "partners"
    : pathname === "/"
      ? "dashboard"
      : pathname.slice(1);
  if (!sections.some((name) => name.toLowerCase() === section)) return children;
  return (
    <>
      <Workspace
        initialSection={section}
        verificationDriverId={
          verificationPage ? pathname.split("/")[3] : undefined
        }
      />
      {children}
    </>
  );
}
