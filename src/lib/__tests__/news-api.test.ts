import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/news/route";
import { clearAllCache } from "@/lib/server-cache";
import type { NextRequest } from "next/server";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("GET /api/news", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the cross-request server cache so tests are isolated.
    clearAllCache();
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 when ticker is missing", async () => {
    const url = new URL("http://localhost:3000/api/news");
    const req = {
      url: url.toString(),
      nextUrl: url,
    } as unknown as NextRequest;

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No ticker");
  });

  it("returns news with sentiment score", async () => {
    const mockRSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>BBRI saham naik hari ini</title>
      <link>https://example.com/news/1</link>
      <source>Bisnis Indonesia</source>
      <pubDate>Mon, 06 May 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>BBRI laporan keuntungan positif</title>
      <link>https://example.com/news/2</link>
      <source>CNBC Indonesia</source>
      <pubDate>Mon, 06 May 2026 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockRSS),
    });

    const url = new URL("http://localhost:3000/api/news?ticker=BBRI");
    const req = {
      url: url.toString(),
      nextUrl: url,
    } as unknown as NextRequest;

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("news");
    expect(data).toHaveProperty("sentimentScore");
    expect(data).toHaveProperty("totalArticles");
    expect(Array.isArray(data.news)).toBe(true);
  });

  it("returns empty news array when fetch fails gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const url = new URL("http://localhost:3000/api/news?ticker=BBRI");
    const req = {
      url: url.toString(),
      nextUrl: url,
    } as unknown as NextRequest;

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.news).toEqual([]);
    expect(data.totalArticles).toBe(0);
  });

  it("deduplicates news by title", async () => {
    const mockRSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Saham BBRI naik</title>
      <link>https://example.com/1</link>
      <source>Bisnis</source>
      <pubDate>Mon, 06 May 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Saham BBRI naik</title>
      <link>https://example.com/2</link>
      <source>CNBC</source>
      <pubDate>Mon, 06 May 2026 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockRSS),
    });

    const url = new URL("http://localhost:3000/api/news?ticker=BBRI");
    const req = {
      url: url.toString(),
      nextUrl: url,
    } as unknown as NextRequest;

    const response = await GET(req);
    const data = await response.json();

    expect(data.news.length).toBe(1);
  });

  it("limits results to 10 articles", async () => {
    const mockRSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    ${Array(15).fill(null).map((_, i) => `
    <item>
      <title>News ${i}</title>
      <link>https://example.com/${i}</link>
      <source>Source ${i}</source>
      <pubDate>Mon, 06 May 2026 10:00:00 GMT</pubDate>
    </item>`).join("")}
  </channel>
</rss>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockRSS),
    });

    const url = new URL("http://localhost:3000/api/news?ticker=BBRI");
    const req = {
      url: url.toString(),
      nextUrl: url,
    } as unknown as NextRequest;

    const response = await GET(req);
    const data = await response.json();

    expect(data.news.length).toBeLessThanOrEqual(10);
    expect(data.totalArticles).toBeLessThanOrEqual(10);
  });
});
