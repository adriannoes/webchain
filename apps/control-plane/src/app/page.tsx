"use client";

import { ASAP_BROWSER_SKILLS } from "@webchain/asap-adapter";
import { RUNTIME_ACTIONS } from "@webchain/protocol";
import type { CSSProperties } from "react";
import { useState } from "react";
import {
  COMPANION_TROUBLESHOOTING_LINES,
  fetchCompanionJson,
} from "../lib/companion-fetch";

const companionUrl =
  process.env.NEXT_PUBLIC_COMPANION_URL ?? "http://127.0.0.1:8787";
const localToken =
  process.env.NEXT_PUBLIC_WEBCHAIN_LOCAL_TOKEN ?? "change-me-in-local-dev";
const defaultUrl = "https://example.com";

type CommandEnvelope = {
  error?: string;
  result?: unknown;
};

async function callCompanion<T>(
  path: string,
  init?: { method?: string; body?: string },
): Promise<T> {
  return fetchCompanionJson<T>(path, {
    companionUrl,
    localToken,
    method: init?.method,
    body: init?.body,
  });
}

export default function HomePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState(defaultUrl);
  const [status, setStatus] = useState("Runtime idle");
  const [output, setOutput] = useState("No command executed yet.");

  const pretty = (value: unknown) => JSON.stringify(value, null, 2);

  const run = async (label: string, task: () => Promise<unknown>) => {
    try {
      setStatus(`${label}...`);
      const data = await task();
      setOutput(pretty(data));
      setStatus(`${label} complete`);
    } catch (error) {
      setStatus(`${label} failed`);
      setOutput(
        pretty({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    }
  };

  return (
    <main
      style={{
        maxWidth: 1180,
        margin: "0 auto",
        padding: "72px 24px 96px",
        display: "grid",
        gap: 24,
      }}
    >
      <section style={{ display: "grid", gap: 12 }}>
        <span
          style={{
            display: "inline-flex",
            width: "fit-content",
            border: "1px solid rgba(96, 165, 250, 0.3)",
            borderRadius: 999,
            padding: "6px 12px",
            color: "#9bd3ff",
            fontSize: 13,
            letterSpacing: 0.2,
          }}
        >
          Webchain / Runtime-first browser kernel
        </span>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(2.6rem, 6vw, 5rem)",
            lineHeight: 1,
          }}
        >
          Control plane for a lightweight agent browser.
        </h1>
        <p style={{ margin: 0, color: "#9fb3c8", maxWidth: 800, fontSize: 18 }}>
          This first slice proves the local loop between the Vercel-ready UI,
          the companion daemon, the browser runtime, and the ASAP-ready gateway.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <article style={panelStyle}>
          <h2 style={headingStyle}>Local runtime loop</h2>
          <p style={{ margin: 0, color: "#9fb3c8" }}>
            Companion at <code>{companionUrl}</code>
          </p>
          <aside
            style={{
              margin: 0,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(251, 191, 36, 0.25)",
              background: "rgba(120, 53, 15, 0.2)",
              color: "#fde68a",
              fontSize: 13,
              lineHeight: 1.5,
            }}
            role="note"
            aria-label="Companion troubleshooting hints"
          >
            <strong style={{ color: "#fcd34d" }}>If requests fail:</strong>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {COMPANION_TROUBLESHOOTING_LINES.map((line) => (
                <li key={line} style={{ marginBottom: 6 }}>
                  {line}
                </li>
              ))}
            </ul>
          </aside>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: "#9fb3c8" }}>Target URL</span>
            <input
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              style={inputStyle}
            />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              type="button"
              onClick={() =>
                run("Health check", () => callCompanion("/health"))
              }
              style={buttonStyle}
            >
              Ping companion
            </button>
            <button
              type="button"
              onClick={() =>
                run("Create session", async () => {
                  const session = await callCompanion<{ sessionId: string }>(
                    "/sessions",
                    {
                      method: "POST",
                      body: JSON.stringify({}),
                    },
                  );
                  setSessionId(session.sessionId);
                  return session;
                })
              }
              style={buttonStyle}
            >
              Create session
            </button>
            <button
              type="button"
              disabled={!sessionId}
              onClick={() =>
                run("Navigate", () =>
                  callCompanion<CommandEnvelope>("/commands", {
                    method: "POST",
                    body: JSON.stringify({
                      action: "navigate",
                      sessionId,
                      url: targetUrl,
                    }),
                  }),
                )
              }
              style={buttonStyle}
            >
              Navigate
            </button>
            <button
              type="button"
              disabled={!sessionId}
              onClick={() =>
                run("Snapshot", () =>
                  callCompanion<CommandEnvelope>("/commands", {
                    method: "POST",
                    body: JSON.stringify({
                      action: "snapshot",
                      sessionId,
                    }),
                  }),
                )
              }
              style={buttonStyle}
            >
              Snapshot
            </button>
          </div>
          <p style={{ margin: 0, color: "#9bd3ff" }}>
            Active session: <code>{sessionId ?? "not created yet"}</code>
          </p>
        </article>

        <article style={panelStyle}>
          <h2 style={headingStyle}>Runtime capabilities</h2>
          <ul style={listStyle}>
            {RUNTIME_ACTIONS.map((action) => (
              <li key={action}>
                <code>{action}</code>
              </li>
            ))}
          </ul>
          <h2 style={{ ...headingStyle, marginTop: 8 }}>ASAP-ready skills</h2>
          <ul style={listStyle}>
            {ASAP_BROWSER_SKILLS.map((skill) => (
              <li key={skill.id}>
                <strong style={{ color: "#e5f0ff" }}>{skill.id}</strong>
                <div>{skill.description}</div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section style={panelStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <h2 style={headingStyle}>Runtime output</h2>
          <span style={{ color: "#9bd3ff" }}>{status}</span>
        </div>
        <pre
          style={outputStyle}
          role={status.endsWith("failed") ? "alert" : undefined}
        >
          {output}
        </pre>
      </section>
    </main>
  );
}

const panelStyle: CSSProperties = {
  background: "rgba(7, 17, 31, 0.78)",
  border: "1px solid rgba(147, 197, 253, 0.18)",
  borderRadius: 20,
  padding: 20,
  backdropFilter: "blur(12px)",
  display: "grid",
  gap: 12,
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
};

const buttonStyle: CSSProperties = {
  border: "1px solid rgba(96, 165, 250, 0.28)",
  borderRadius: 14,
  background:
    "linear-gradient(180deg, rgba(96, 165, 250, 0.22), rgba(56, 189, 248, 0.16))",
  color: "#e5f0ff",
  padding: "12px 14px",
  cursor: "pointer",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(147, 197, 253, 0.2)",
  background: "rgba(3, 10, 18, 0.94)",
  color: "#e5f0ff",
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#9fb3c8",
  display: "grid",
  gap: 10,
};

const outputStyle: CSSProperties = {
  margin: 0,
  overflowX: "auto",
  padding: 16,
  borderRadius: 16,
  background: "rgba(3, 10, 18, 0.94)",
  border: "1px solid rgba(147, 197, 253, 0.14)",
  color: "#c2e1ff",
  minHeight: 240,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
