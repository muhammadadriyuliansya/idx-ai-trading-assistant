import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callAI, listOllamaModels, resolveOllamaBaseUrl } from "@/lib/ai-provider";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("ai-provider", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("resolveOllamaBaseUrl", () => {
    it("defaults to http://localhost:11434 when nothing is passed", () => {
      expect(resolveOllamaBaseUrl()).toBe("http://localhost:11434");
    });

    it("strips trailing slashes from override", () => {
      expect(resolveOllamaBaseUrl("http://remote:11434///")).toBe("http://remote:11434");
    });

    it("trims whitespace", () => {
      expect(resolveOllamaBaseUrl("  http://x:1234  ")).toBe("http://x:1234");
    });
  });

  describe("callAI — OpenAI", () => {
    it("sends chat completion request and returns text", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ choices: [{ message: { content: "hi" } }] }),
      });

      const result = await callAI({
        provider: "openai",
        model: "gpt-4o-mini",
        system: "sys",
        user: "hello",
        apiKey: "sk-test",
      });

      expect(result.text).toBe("hi");
      expect(result.provider).toBe("openai");

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.model).toBe("gpt-4o-mini");
      expect(body.messages).toHaveLength(2);
    });

    it("adds response_format when format is json", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ choices: [{ message: { content: "{}" } }] }),
      });

      await callAI({
        provider: "openai",
        model: "gpt-4o-mini",
        system: "sys",
        user: "u",
        apiKey: "sk",
        format: "json",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.response_format).toEqual({ type: "json_object" });
    });

    it("throws without apiKey", async () => {
      await expect(
        callAI({ provider: "openai", model: "x", system: "s", user: "u" }),
      ).rejects.toThrow(/API key/);
    });
  });

  describe("callAI — Anthropic", () => {
    it("sends messages request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ type: "text", text: "ok" }] }),
      });

      const result = await callAI({
        provider: "anthropic",
        model: "claude-3-5-haiku-latest",
        system: "sys",
        user: "u",
        apiKey: "ak",
      });

      expect(result.text).toBe("ok");
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.anthropic.com/v1/messages");
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers["x-api-key"]).toBe("ak");
    });

    it("appends JSON instruction when format=json", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ type: "text", text: "{}" }] }),
      });

      await callAI({
        provider: "anthropic",
        model: "m",
        system: "base",
        user: "u",
        apiKey: "k",
        format: "json",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.system).toContain("valid JSON");
    });
  });

  describe("callAI — Ollama", () => {
    it("posts to /api/chat on local daemon", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: "hello from gemma" }, done: true }),
      });

      const result = await callAI({
        provider: "ollama",
        model: "gemma4:e4b",
        system: "s",
        user: "u",
      });

      expect(result.text).toBe("hello from gemma");
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:11434/api/chat");
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.model).toBe("gemma4:e4b");
      expect(body.stream).toBe(false);
    });

    it("uses baseUrl override", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: "x" } }),
      });

      await callAI({
        provider: "ollama",
        model: "m",
        system: "s",
        user: "u",
        baseUrl: "http://gpu-box:11434",
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("http://gpu-box:11434/api/chat");
    });

    it("forwards format=json as Ollama format field", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: "{}" } }),
      });

      await callAI({
        provider: "ollama",
        model: "m",
        system: "s",
        user: "u",
        format: "json",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.format).toBe("json");
    });

    it("surfaces Ollama error payload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "boom",
      });

      await expect(
        callAI({ provider: "ollama", model: "m", system: "s", user: "u" }),
      ).rejects.toThrow(/Ollama HTTP 500/);
    });
  });

  describe("listOllamaModels", () => {
    it("returns model names from /api/tags", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: "gemma4:e4b" }, { name: "llama3.2:3b" }] }),
      });

      const models = await listOllamaModels();
      expect(models).toEqual(["gemma4:e4b", "llama3.2:3b"]);
    });

    it("returns empty array on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const models = await listOllamaModels();
      expect(models).toEqual([]);
    });

    it("returns empty array on non-OK response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const models = await listOllamaModels();
      expect(models).toEqual([]);
    });
  });
});
