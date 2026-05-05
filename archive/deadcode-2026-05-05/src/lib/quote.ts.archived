"use client";

import { useCallback, useState } from "react";
import type { QuoteResult } from "@/lib/types";

export interface QuoteState {
  loading: boolean;
  error: string | null;
  data: QuoteResult | null;
}

export function useQuoteFetch() {
  const [state, setState] = useState<QuoteState>({
    loading: false,
    error: null,
    data: null,
  });

  const fetchQuote = useCallback(
    async (ticker: string): Promise<QuoteResult | null> => {
      setState({ loading: true, error: null, data: null });
      try {
        const res = await fetch(
          `/api/quote?ticker=${encodeURIComponent(ticker)}`,
          { cache: "no-store" },
        );
        const json = await res.json();
        if (!res.ok) {
          const msg =
            typeof json?.error === "string"
              ? json.error
              : `Fetch gagal (HTTP ${res.status}).`;
          setState({ loading: false, error: msg, data: null });
          return null;
        }
        const data = json as QuoteResult;
        setState({ loading: false, error: null, data });
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        setState({ loading: false, error: msg, data: null });
        return null;
      }
    },
    [],
  );

  return { ...state, fetchQuote } as const;
}

export function describeQuoteMeta(data: QuoteResult): string {
  const m = data.meta;
  const parts: string[] = [];
  parts.push(`${data.ticker} · ${m.barsCount} bars · ${m.lastBarDate}`);
  parts.push(`Trend ${m.trend}`);
  if (m.volRatio > 0) parts.push(`Vol ${m.volRatio.toFixed(2)}x avg`);
  if (m.ihsgTrend !== "unknown") {
    const change =
      m.ihsgChange5d !== undefined
        ? ` 5d ${m.ihsgChange5d >= 0 ? "+" : ""}${m.ihsgChange5d.toFixed(2)}%`
        : "";
    parts.push(`IHSG ${m.ihsgTrend}${change}`);
  }
  return parts.join(" · ");
}
