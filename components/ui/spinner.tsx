import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0 motion-safe:animate-spin", className)}
    />
  );
}
