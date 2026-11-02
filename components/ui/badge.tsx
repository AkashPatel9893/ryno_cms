import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-3xl border-0 px-3 py-[9px] text-[11px] font-normal",
  {
    variants: {
      variant: {
        default: "bg-[var(--soft)] text-[var(--muted)]",
        orange: "bg-[var(--accent-soft)] text-[var(--accent-text)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}
export { Badge, badgeVariants };
