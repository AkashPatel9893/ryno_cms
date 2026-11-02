"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Workspace from "@/components/cms/workspace";
import { sections } from "@/components/cms/navigation";

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const section = pathname === "/" ? "dashboard" : pathname.slice(1);
  if (!sections.some((name) => name.toLowerCase() === section)) return children;
  return (
    <>
      <Workspace initialSection={section} />
      {children}
    </>
  );
}
