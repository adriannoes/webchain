# OpenAI Agents SDK (smoke / integration notes)

**Status:** documentation stub for Phase 2 — wire your Agents SDK client to the Webchain MCP server (stdio) per upstream docs.

## Preconditions

1. Companion: `pnpm dev:companion` (from repo root).
2. MCP: configure your agent host to launch `pnpm --filter @webchain/mcp start` (or `tsx services/mcp/src/index.ts`) with:
   - `WEBCHAIN_COMPANION_ORIGIN=http://127.0.0.1:8787`
   - `WEBCHAIN_LOCAL_TOKEN` matching the companion.

## Validation

Run the repository’s MCP conformance suite (no OpenAI API key required):

`pnpm test:mcp-conformance`

## Product reference

[`product/specs/prd-phase-2-mcp-native-surface.md`](../../../product/specs/prd-phase-2-mcp-native-surface.md)
