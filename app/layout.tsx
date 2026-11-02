import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { StoreProvider } from "@/components/cms/store-provider";
import { QueryProvider } from "@/components/cms/query-provider";
export const metadata: Metadata = {
  title: "Ryno · Operations workspace",
  description: "Ryno mobility operations CMS",
  twitter: { card: "summary_large_image" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <StoreProvider>
            <QueryProvider>{children}</QueryProvider>
          </StoreProvider>
        </Suspense>
      </body>
    </html>
  );
}
