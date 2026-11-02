import { notFound } from "next/navigation";
import { sections } from "@/components/cms/navigation";
export function generateStaticParams() {
  return sections.map((section) => ({ section: section.toLowerCase() }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.some((name) => name.toLowerCase() === section)) notFound();
  return null;
}
