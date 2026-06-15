/**
 * SEODesignLab MCP Server
 *
 * Exposes x402-protected SEO endpoints as MCP tools so AI agents
 * (Claude, Cursor, VS Code, etc.) can discover and use them via
 * the Model Context Protocol.
 *
 * Pricing (USDC on Polygon):
 *   - Content Brief:  $2.00
 *   - Keyword Research: $1.50
 *   - SERP Analysis:   $2.00
 *   - Backlink Profile: $3.00
 *   - On-Page Audit:  $2.50
 *
 * The server reads SEO_API_BASE from the environment to know
 * where to send requests.  Default: https://seo-content-brief-tool.onrender.com
 *
 * For x402 payments the server reads X402_PAY_TO (wallet) and
 * X402_NETWORK (default "polygon").  When these are set every
 * outgoing request includes the x402 payment header so the
 * Cloudflare Worker paywall can settle the micropayment
 * automatically.  When they are *not* set the server falls back
 * to returning the 402 payload from the upstream, giving the
 * caller the information it needs to pay manually.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SEO_API_BASE =
  process.env.SEO_API_BASE ??
  "https://seo-content-brief-tool.onrender.com";

/** Polygon wallet that receives x402 payments */
const X402_PAY_TO = process.env.X402_PAY_TO ?? "";
/** Network for x402 settlement (default: polygon) */
const X402_NETWORK = process.env.X402_NETWORK ?? "polygon";

// ---------------------------------------------------------------------------
// Pricing table — mirrors the Cloudflare Worker PROTECTED_PATTERNS
// ---------------------------------------------------------------------------

interface PriceEntry {
  path: string;
  price: string;
  usd: string;
  description: string;
}

const PRICING: Record<string, PriceEntry> = {
  content_brief: {
    path: "/api/briefs/",
    price: "$2.00",
    usd: "2.00",
    description: "Content Brief — detailed writing guidelines from a POP report",
  },
  keyword_research: {
    path: "/api/dataforseo/keywords/",
    price: "$1.50",
    usd: "1.50",
    description: "Keyword Research — search volume, CPC, and difficulty",
  },
  serp_analysis: {
    path: "/api/dataforseo/serp/",
    price: "$2.00",
    usd: "2.00",
    description: "SERP Analysis — top 10 organic results with metrics",
  },
  backlink_profile: {
    path: "/api/dataforseo/backlinks/",
    price: "$3.00",
    usd: "3.00",
    description: "Backlink Analysis — referring domains and link profiles",
  },
  on_page_audit: {
    path: "/api/dataforseo/audit/",
    price: "$2.50",
    usd: "2.50",
    description: "On-Page Audit — comprehensive SEO analysis",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Call the SEO backend.  If X402_PAY_TO is configured we attach the
 * x402 payment header automatically; otherwise we forward the response
 * as-is (which may be a 402 Payment Required with payment instructions).
 */
async function callSEOApi(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  priceInfo?: PriceEntry,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = `${SEO_API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // If x402 wallet is configured, add payment header so the CF Worker
  // can settle automatically.  In a real production deployment the MCP
  // server would use an x402 client to sign and attach a valid payment.
  // For now we signal intent; the CF Worker validates on the other side.
  if (X402_PAY_TO && priceInfo) {
    headers["X-Payment-Version"] = "1";
    headers["X-Payment-Type"] = "x402";
    headers["X-Payment-Amount"] = priceInfo.usd;
    headers["X-Payment-Asset"] = "USDC";
    headers["X-Payment-Network"] = X402_NETWORK;
    headers["X-Payment-Pay-To"] = X402_PAY_TO;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const contentType = response.headers.get("content-type") ?? "";

  let data: unknown;
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  // If we got a 402, attach payment instructions
  if (response.status === 402) {
    return {
      ok: false,
      status: 402,
      data: {
        error: "Payment Required",
        price: priceInfo?.price ?? "unknown",
        description: priceInfo?.description ?? "SEO API call",
        network: X402_NETWORK,
        payTo: X402_PAY_TO || "0xe6c9082fac7AA6A3fdA70D679C5536939c5B4145",
        message: `This endpoint requires an x402 micropayment of ${priceInfo?.price ?? "unknown"} on ${X402_NETWORK}. Use an x402-compatible client to settle automatically, or send USDC to the pay-to address.`,
        ...(typeof data === "object" && data !== null ? data : {}),
      },
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

/**
 * Format an API response for MCP output.
 */
function formatResponse(result: { ok: boolean; status: number; data: unknown }): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result.data, null, 2),
      },
    ],
    ...(result.ok ? {} : { isError: true }),
  };
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "seodesignlab-seo",
  version: "1.0.0",
});

// ---- Tool: get_content_brief ------------------------------------------------

server.tool(
  "get_content_brief",
  `Generate a POP (PageOptimizer Pro) content brief for a target keyword.

Price: $2.00 (x402 on Polygon)

Returns a detailed content brief including:
- Target keyword analysis
- Recommended word count and headings
- LSI terms and semantic keywords
- Title and meta description suggestions
- Content structure guidelines`,
  {
    keyword: z.string().describe("Target keyword for the content brief"),
    location: z
      .string()
      .optional()
      .describe("Optional location/geo targeting (e.g. 'United States', 'Florida')"),
    language: z
      .string()
      .optional()
      .describe("Language code (default: 'en')"),
  },
  async ({ keyword, location, language }) => {
    const priceInfo = PRICING.content_brief;
    const result = await callSEOApi("POST", priceInfo.path, {
      keyword,
      ...(location ? { location } : {}),
      ...(language ? { language } : {}),
    }, priceInfo);
    return formatResponse(result);
  },
);

// ---- Tool: keyword_research -------------------------------------------------

server.tool(
  "keyword_research",
  `Research keyword metrics including search volume, CPC, and competition difficulty.

Price: $1.50 (x402 on Polygon)

Returns:
- Monthly search volume
- Cost per click (CPC)
- Competition level / difficulty
- Related keyword suggestions`,
  {
    keyword: z.string().describe("Target keyword to research"),
    location: z
      .string()
      .optional()
      .describe("Geo target (e.g. 'United States')"),
    language: z
      .string()
      .optional()
      .describe("Language code (default: 'en')"),
  },
  async ({ keyword, location, language }) => {
    const priceInfo = PRICING.keyword_research;
    const result = await callSEOApi("POST", priceInfo.path, {
      keyword,
      ...(location ? { location } : {}),
      ...(language ? { language } : {}),
    }, priceInfo);
    return formatResponse(result);
  },
);

// ---- Tool: serp_analysis -----------------------------------------------------

server.tool(
  "serp_analysis",
  `Analyze the top 10 SERP results for a keyword with metrics.

Price: $2.00 (x402 on Polygon)

Returns:
- Top 10 organic results with URLs
- Domain authority / rating for each
- Title and description snippets
- SERP feature detection (featured snippets, PAA, etc.)`,
  {
    keyword: z.string().describe("Target keyword for SERP analysis"),
    location: z
      .string()
      .optional()
      .describe("Geo target (e.g. 'United States')"),
    language: z
      .string()
      .optional()
      .describe("Language code (default: 'en')"),
  },
  async ({ keyword, location, language }) => {
    const priceInfo = PRICING.serp_analysis;
    const result = await callSEOApi("POST", priceInfo.path, {
      keyword,
      ...(location ? { location } : {}),
      ...(language ? { language } : {}),
    }, priceInfo);
    return formatResponse(result);
  },
);

// ---- Tool: backlink_profile -------------------------------------------------

server.tool(
  "backlink_profile",
  `Get the backlink profile for a domain — referring domains, link metrics, and anchor text analysis.

Price: $3.00 (x402 on Polygon)

Returns:
- Referring domains count
- Backlinks count
- Domain rating / authority
- Top referring domains with link metrics
- Anchor text distribution`,
  {
    domain: z.string().describe("Domain to analyze (e.g. 'example.com')"),
  },
  async ({ domain }) => {
    const priceInfo = PRICING.backlink_profile;
    const result = await callSEOApi("POST", priceInfo.path, {
      domain,
    }, priceInfo);
    return formatResponse(result);
  },
);

// ---- Tool: on_page_audit ----------------------------------------------------

server.tool(
  "on_page_audit",
  `Run a comprehensive on-page SEO audit for a URL.

Price: $2.50 (x402 on Polygon)

Returns:
- Meta title and description analysis
- Heading structure (H1-H6)
- Image alt text coverage
- Internal/external link counts
- Page speed insights
- Content quality metrics
- Technical SEO issues`,
  {
    url: z.string().describe("Full URL to audit (e.g. 'https://example.com/page')"),
  },
  async ({ url }) => {
    const priceInfo = PRICING.on_page_audit;
    const result = await callSEOApi("POST", priceInfo.path, {
      url,
    }, priceInfo);
    return formatResponse(result);
  },
);

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP servers communicate over stdin/stdout — log to stderr so we don't
  // corrupt the protocol stream.
  console.error("SEODesignLab MCP Server running on stdio");
  console.error(`  API base: ${SEO_API_BASE}`);
  console.error(`  x402 pay-to: ${X402_PAY_TO || "(not configured)"}`);
  console.error(`  Network: ${X402_NETWORK}`);
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});