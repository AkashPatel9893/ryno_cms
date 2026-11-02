import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-3xl border-0 px-3 py-[9px] text-[11px] font-normal",
  {
    variants: {
      variant: {
        default: "bg-[#f1eadf] text-[#6e695f]",
        orange: "bg-[#ffe0d2] text-[#b83b0d]",
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
