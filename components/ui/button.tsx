import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

// Adapted from the shadcn/ui New York button to the CMS colour palette.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff571e] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "border-[#d33f0c] bg-[#d33f0c] text-white hover:bg-[#bd3508]",
        outline: "border-[#eeece6] bg-white text-[#20211d] hover:bg-[#f1eee8]",
      },
      size: { default: "min-h-[41px] px-[22px] py-[13px]" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
export { Button, buttonVariants };
