import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#eeece6] bg-white p-8 text-center shadow-sm sm:p-12">
        <span className="mb-4 inline-flex rounded-full bg-[#ffe0d2] px-3 py-1 text-xs font-semibold text-[#a83910]">
          404
        </span>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-[#747168]">
          This page isn’t available. Check the address or return to the
          dashboard.
        </p>
        <Button asChild className="mt-7">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
