import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AIRequestBody {
  provider: "openai" | "anthropic";
  model: string;
  apiKey: string;
  system: string;
  user: string;
}

function isValidBody(body: unknown): body is AIRequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    (b.provider === "openai" || b.provider === "anthropic") &&
    typeof b.model === "string" &&
    typeof b.apiKey === "string" &&
    typeof b.system === "string" &&
    typeof b.user === "string"
  );
}

async function callOpenAI(body: AIRequestBody): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${body.apiKey}`,
    },
    body: JSON.stringify({
      model: body.model,
      temperature: 0.4,
      messages: [
        { role: "system", content: body.system },
        { role: "user", content: body.user },
      ],
    }),
  });

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    const msg = data?.error?.message || `OpenAI HTTP ${res.status}`;
    throw new Error(msg);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned empty response");
  return text;
}

async function callAnthropic(body: AIRequestBody): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": body.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: body.model,
      max_tokens: 1500,
      temperature: 0.4,
      system: body.system,
      messages: [{ role: "user", content: body.user }],
    }),
  });

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    const msg = data?.error?.message || `Anthropic HTTP ${res.status}`;
    throw new Error(msg);
  }
  const text = data?.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned empty response");
  return text;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: "Missing or invalid fields: provider, model, apiKey, system, user" },
      { status: 400 },
    );
  }
  if (!body.apiKey) {
    return NextResponse.json(
      { error: "API key kosong. Set di Settings dulu." },
      { status: 400 },
    );
  }

  try {
    const text =
      body.provider === "openai"
        ? await callOpenAI(body)
        : await callAnthropic(body);
    return NextResponse.json({ text, model: body.model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
