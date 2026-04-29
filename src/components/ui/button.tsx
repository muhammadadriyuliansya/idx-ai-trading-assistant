"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.35),0_8px_24px_-12px_rgba(59,130,246,0.6)] hover:bg-blue-500",
        accent:
          "bg-emerald-500/90 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.4),0_8px_24px_-12px_rgba(16,185,129,0.5)] hover:bg-emerald-500",
        outline:
          "border border-zinc-800 bg-zinc-950/40 text-zinc-100 hover:border-zinc-700 hover:bg-zinc-900/60",
        ghost:
          "text-zinc-300 hover:bg-zinc-900/60 hover:text-zinc-100",
        destructive:
          "bg-red-600/90 text-white hover:bg-red-500",
        subtle:
          "bg-zinc-900/70 text-zinc-100 hover:bg-zinc-800/80 border border-zinc-800",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-5 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
