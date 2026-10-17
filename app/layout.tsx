import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Ryno · Operations workspace", description: "Ryno mobility operations CMS — demonstration workspace" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
