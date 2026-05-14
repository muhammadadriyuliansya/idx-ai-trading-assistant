"use client";

/**
 * Client wrapper untuk Telegram notifications.
 * Di-call dari scanner / analysis / position tabs.
 *
 * Semua fungsi ini no-throw — return { ok, error } supaya UI bisa kasih
 * feedback tanpa try/catch di caller.
 */

export interface NotifyResult {
  ok: boolean;
  error?: string;
  messageId?: number;
}

export async function sendTelegramMessage(
  text: string,
  opts?: { chatId?: string; silent?: boolean },
): Promise<NotifyResult> {
  try {
    const res = await fetch("/api/notify/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        chatId: opts?.chatId,
        silent: opts?.silent ?? false,
      }),
    });
    const data = (await res.json()) as NotifyResult;
    return data;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkTelegramHealth(): Promise<{
  ok: boolean;
  error?: string;
  botUsername?: string;
  botName?: string;
  chatIdConfigured?: boolean;
}> {
  try {
    const res = await fetch("/api/notify/telegram");
    return (await res.json()) as {
      ok: boolean;
      error?: string;
      botUsername?: string;
      botName?: string;
      chatIdConfigured?: boolean;
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Message templates
// ---------------------------------------------------------------------------

export interface ScannerAlertTemplate {
  ticker: string;
  setupScore: number;
  rr: number;
  status: "VALID" | "WATCHLIST" | "REJECT";
  reason: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  volumeRatio: number;
  trend: string;
}

export function formatScannerAlert(t: ScannerAlertTemplate): string {
  const emoji = t.status === "VALID" ? "🟢" : t.status === "WATCHLIST" ? "🟡" : "🔴";
  return [
    `${emoji} *${t.ticker}* — ${t.status} (${t.setupScore}/100)`,
    ``,
    `Entry: \`${t.entry.toLocaleString("id-ID")}\``,
    `Stop:  \`${t.stopLoss.toLocaleString("id-ID")}\``,
    `TP:    \`${t.takeProfit.toLocaleString("id-ID")}\``,
    `RR:    \`${t.rr.toFixed(2)}\`  |  Vol: \`${t.volumeRatio.toFixed(2)}x\`  |  ${t.trend}`,
    ``,
    `_${t.reason}_`,
  ].join("\n");
}

export interface PositionAlertTemplate {
  ticker: string;
  status: string;
  currentPrice: number;
  entry: number;
  unrealizedNetPnl: number;
  rMultiple: number | null;
  suggestedTrail: number;
  stopLoss: number;
  tp1: number;
}

export function formatPositionAlert(t: PositionAlertTemplate): string {
  const pnlEmoji = t.unrealizedNetPnl >= 0 ? "🟢" : "🔴";
  const rStr = t.rMultiple !== null ? `${t.rMultiple.toFixed(2)}R` : "—";
  return [
    `${pnlEmoji} *${t.ticker}* — ${t.status}`,
    ``,
    `Now:   \`${t.currentPrice.toLocaleString("id-ID")}\` (entry ${t.entry.toLocaleString("id-ID")})`,
    `P&L:   *${t.unrealizedNetPnl.toLocaleString("id-ID")}* (${rStr})`,
    `Stop:  \`${t.stopLoss.toLocaleString("id-ID")}\`  →  trail ke \`${t.suggestedTrail.toLocaleString("id-ID")}\``,
    `TP1:   \`${t.tp1.toLocaleString("id-ID")}\``,
  ].join("\n");
}

export interface TradeClosedTemplate {
  ticker: string;
  netPnl: number;
  rMultiple: number;
  netPct: number;
  exitReason: string;
}

export function formatTradeClosed(t: TradeClosedTemplate): string {
  const emoji = t.netPnl > 0 ? "✅" : t.netPnl < 0 ? "❌" : "⚪";
  return [
    `${emoji} *${t.ticker}* CLOSED`,
    ``,
    `Net:   *${t.netPnl.toLocaleString("id-ID")}* (${t.netPct >= 0 ? "+" : ""}${t.netPct.toFixed(2)}%)`,
    `R:     \`${t.rMultiple.toFixed(2)}R\``,
    `Exit:  ${t.exitReason}`,
  ].join("\n");
}
