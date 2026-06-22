# @seodesignlab/mcp-server

MCP (Model Context Protocol) server for **SEODesignLab's x402-protected SEO endpoints**.

Expose professional SEO tools — content briefs, keyword research, SERP analysis, backlink profiles, and on-page audits — to any MCP-compatible AI agent (Claude Desktop, Cursor, VS Code Copilot, etc.) with automatic x402 micropayment handling on Base.

---

## Tools

| Tool | Endpoint | Price | Description |
|------|----------|-------|-------------|
| `get_content_brief` | `/api/briefs/` | $2.00 | Generate a POP content brief with keyword analysis, LSI terms, and content structure |
| `keyword_research` | `/api/dataforseo/keywords/` | $1.50 | Search volume, CPC, and competition difficulty for a keyword |
| `serp_analysis` | `/api/dataforseo/serp/` | $2.00 | Top 10 organic results with domain metrics and SERP features |
| `backlink_profile` | `/api/dataforseo/backlinks/` | $3.00 | Referring domains, link metrics, and anchor text distribution |
| `on_page_audit` | `/api/dataforseo/audit/` | $2.50 | Full on-page SEO audit — meta, headings, images, links, speed |

All prices are in **USDC on Base** and settled via the [x402 protocol](https://x402.org).

---

## Quick Start

### Install

```bash
npm install @seodesignlab/mcp-server
# or
npx @seodesignlab/mcp-server
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SEO_API_BASE` | `https://seo-content-brief-tool.onrender.com` | Base URL of the SEO API backend |
| `X402_PAY_TO` | *(none)* | Base wallet address for x402 payments. When set, payment headers are attached automatically. |
| `X402_NETWORK` | `base` | Network for x402 settlement

---

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "seodesignlab-seo": {
      "command": "npx",
      "args": ["-y", "@seodesignlab/mcp-server"],
      "env": {
        "SEO_API_BASE": "https://seo-content-brief-tool.onrender.com",
        "X402_PAY_TO": "0xc78e3D02622061961156a18E10bbbF07d8e94529",
        "X402_NETWORK": "base"
      }
    }
  }
}
```

**Config file locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json` in your project root or global settings):

```json
{
  "mcpServers": {
    "seodesignlab-seo": {
      "command": "npx",
      "args": ["-y", "@seodesignlab/mcp-server"],
      "env": {
        "SEO_API_BASE": "https://seo-content-brief-tool.onrender.com",
        "X402_PAY_TO": "0xc78e3D02622061961156a18E10bbbF07d8e94529",
        "X402_NETWORK": "base"
      }
    }
  }
}
```

### VS Code (Copilot)

Add to your VS Code MCP settings (`.vscode/mcp.json`):

```json
{
  "servers": {
    "seodesignlab-seo": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@seodesignlab/mcp-server"],
      "env": {
        "SEO_API_BASE": "https://seo-content-brief-tool.onrender.com",
        "X402_PAY_TO": "0xc78e3D02622061961156a18E10bbbF07d8e94529",
        "X402_NETWORK": "base"
      }
    }
  }
}
```

---

## Usage Examples

Once configured, the SEO tools appear automatically in your AI agent. Just ask:

### Content Brief

```
Generate a content brief for "HVAC repair Brooklyn"
```

→ Calls `get_content_brief` → Returns POP brief with LSI terms, word count targets, heading structure.

### Keyword Research

```
What's the search volume and CPC for "roofing contractor Tampa"?
```

→ Calls `keyword_research` → Returns monthly volume, CPC, competition score.

### SERP Analysis

```
Show me the top 10 results for "dentist near me" in Rockville Centre
```

→ Calls `serp_analysis` → Returns top 10 results with domain authority, titles, descriptions.

### Backlink Profile

```
Analyze the backlink profile of seodesignlab.com
```

→ Calls `backlink_profile` → Returns referring domains, link counts, domain rating.

### On-Page Audit

```
Audit https://drbrattrvc.com/services/teeth-whitening/
```

→ Calls `on_page_audit` → Returns meta analysis, heading structure, image coverage, technical issues.

---

## x402 Payment Flow

```
AI Agent (Claude, Cursor, etc.)
    │
    ▼
MCP Server (this package)
    │
    ▼  Adds X-Payment-* headers
Cloudflare Worker (x402 paywall)
    │
    ├── Payment valid? ──► YES ──► Proxy to SEO API ──► Return data
    │
    └── No payment? ──► 402 + x402 settlement instructions
```

When `X402_PAY_TO` is configured, the MCP server attaches payment headers to every request. The Cloudflare Worker validates the x402 payment and either:

1. **Paid** → Forwards the request to the SEO backend on Render, returns the result.
2. **Unpaid** → Returns a `402 Payment Required` with the price, wallet address, and settlement instructions.

### x402 Client Integration

For production use, pair this MCP server with an [x402-compatible client](https://github.com/coinbase/x402) that can automatically settle micropayments. The server is designed to be payment-agnostic — it works with or without an x402 client.

---

## API Endpoints

The MCP server proxies to these backend endpoints at `SEO_API_BASE`:

### POST /api/briefs/

**Request:**
```json
{
  "keyword": "HVAC repair Brooklyn",
  "location": "United States",
  "language": "en"
}
```

**Response:** Full POP content brief with keyword analysis, LSI terms, recommended structure.

### POST /api/dataforseo/keywords/

**Request:**
```json
{
  "keyword": "roofing contractor Tampa",
  "location": "United States",
  "language": "en"
}
```

**Response:** Search volume, CPC, competition, related keywords.

### POST /api/dataforseo/serp/

**Request:**
```json
{
  "keyword": "dentist near me",
  "location": "United States",
  "language": "en"
}
```

**Response:** Top 10 organic results with titles, URLs, descriptions, and domain metrics.

### POST /api/dataforseo/backlinks/

**Request:**
```json
{
  "domain": "seodesignlab.com"
}
```

**Response:** Referring domains, backlinks count, domain rating, anchor distribution.

### POST /api/dataforseo/audit/

**Request:**
```json
{
  "url": "https://drbrattrvc.com/services/teeth-whitening/"
}
```

**Response:** Meta title/description analysis, heading structure, image alt coverage, link counts, page speed, content quality, technical issues.

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally (stdio transport)
npm run dev

# Type check
npx tsc --noEmit
```

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Publishing

> ⚠️ **Don't publish yet!** Wait until the Cloudflare Worker paywall is deployed and live.

When ready:

```bash
npm run build
npm publish --access public
```

---

## License

MIT © SEODesignLab