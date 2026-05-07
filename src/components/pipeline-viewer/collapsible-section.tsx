"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type BadgeTone = "neutral" | "blue" | "emerald" | "amber" | "red" | "violet";

export function CollapsibleSection({
  title,
  icon,
  badge,
  badgeTone,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: ReactNode;
  badge?: string;
  badgeTone?: BadgeTone;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-zinc-800/60 bg-zinc-950/60">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-900/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-zinc-400">{icon}</div>
          <span className="text-sm font-semibold text-zinc-200">{title}</span>
          {badge && (
            <Badge tone={badgeTone ?? "neutral"} className="text-[10px]">
              {badge}
            </Badge>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </Card>
  );
}
