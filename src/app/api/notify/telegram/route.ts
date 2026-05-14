/**
 * Telegram notification endpoint.
 *
 * Kirim pesan ke bot Telegram yang udah dikonfigurasi di env.
 * Dipakai dari client untuk:
 *   - Alert saat watchlist ticker hit valid setup
 *   - Notifikasi saat posisi mendekati stop / TP
 *   - Manual push dari UI (tombol Send di card scanner / analysis)
 *
 * Config via env:
 *   TELEGRAM_BOT_TOKEN — wajib
 *   TELEGRAM_CHAT_ID   — opsional, bisa di-override per-request dari client
 *
 * Body JSON: { text: string, chatId?: string, silent?: boolean }
 * Return:    { ok: boolean, error?: string, messageId?: number }
 */

import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:notify:telegram");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NotifyBody {
  text?: string;
  chatId?: string;
  silent?: boolean;
  /** parseMode: 'Markdown' | 'HTML' | undefined (plain). Default Markdown. */
  parseMode?: "Markdown" | "HTML" | "plain";
}

interface TelegramResponse {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
}

export async function POST(request: Request) {
  let body: NotifyBody;
  try {
    body = (await request.json()) as NotifyBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON invalid" }, { status: 400 });
  }

  const text = (body.text ?? "").toString().trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "Field 'text' kosong" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json(
      { ok: false, error: "Pesan terlalu panjang (>4000 chars)" },
      { status: 400 },
    );
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN kosong di env");
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN belum di-set di .env.local" },
      { status: 500 },
    );
  }

  const chatId = (body.chatId ?? process.env.TELEGRAM_CHAT_ID ?? "").toString().trim();
  if (!chatId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Chat ID kosong. Kirim pesan dulu ke bot lu, lalu ambil chat.id dari getUpdates, pasang di Settings atau .env.local.",
      },
      { status: 400 },
    );
  }

  const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
  const parseMode = body.parseMode ?? "Markdown";

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_notification: body.silent ?? false,
        parse_mode: parseMode === "plain" ? undefined : parseMode,
      }),
      // Telegram API kadang lambat kalau traffic padet; kasih timeout 12s
      signal: AbortSignal.timeout(12_000),
    });

    const data = (await res.json()) as TelegramResponse;

    if (!res.ok || !data.ok) {
      logger.warn(`Telegram API rejected: ${data.description ?? res.statusText}`);
      return NextResponse.json(
        { ok: false, error: data.description ?? `Telegram HTTP ${res.status}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, messageId: data.result?.message_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Telegram send failed: ${message}`);
    return NextResponse.json(
      { ok: false, error: `Gagal kirim Telegram: ${message}` },
      { status: 502 },
    );
  }
}

/**
 * Health check — cek apakah bot token valid tanpa ngirim pesan.
 * Panggil dari Settings tab setelah user isi token.
 */
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({
      ok: false,
      error: "TELEGRAM_BOT_TOKEN belum di-set di .env.local",
    });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await res.json()) as {
      ok: boolean;
      result?: { username: string; first_name: string };
      description?: string;
    };
    if (!res.ok || !data.ok) {
      return NextResponse.json({
        ok: false,
        error: data.description ?? `HTTP ${res.status}`,
      });
    }
    return NextResponse.json({
      ok: true,
      botUsername: data.result?.username,
      botName: data.result?.first_name,
      chatIdConfigured: Boolean(process.env.TELEGRAM_CHAT_ID),
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
