# Example agent integrations

Phase 2 adds **documented** integration paths for popular agent stacks. The **authoritative automated check** for MCP + companion + Chromium is the repo’s **`pnpm test:integration`** (includes **`pnpm test:mcp-conformance`**).

## OpenAI Agents SDK

See [openai-agents/README.md](openai-agents/README.md).

## LangGraph

See [langgraph/README.md](langgraph/README.md).

## Environment

Use the same variables as the MCP package README at `services/mcp/README.md` in this repository: **`WEBCHAIN_COMPANION_ORIGIN`**, **`WEBCHAIN_LOCAL_TOKEN`**, and a running **`pnpm dev:companion`** before **`pnpm dev:mcp`**.
