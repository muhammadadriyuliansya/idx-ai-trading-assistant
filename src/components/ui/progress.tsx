import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  tone?: "blue" | "emerald" | "amber" | "red";
}

const toneToBg: Record<NonNullable<ProgressProps["tone"]>, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

export function Progress({
  value,
  max = 100,
  tone = "blue",
  className,
  ...props
}: ProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-zinc-900 ring-1 ring-inset ring-zinc-800",
        className,
      )}
      {...props}
    >
      <div
        className={cn("h-full transition-all duration-500", toneToBg[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
