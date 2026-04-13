import type { RuntimeCommand } from "@webchain/protocol";
import { describe, expect, it } from "vitest";
import {
  ASAP_BROWSER_SKILLS,
  BROWSER_GATEWAY_URN,
  createAsapTaskEnvelope,
  createBrowserGatewayDescriptor,
  mapCommandToAsapSkill,
} from "./index.js";

describe("ASAP_BROWSER_SKILLS", () => {
  it("lists three skills with stable ids", () => {
    expect(ASAP_BROWSER_SKILLS.map((s) => s.id)).toEqual([
      "browse_page",
      "perform_flow",
      "capture_artifact",
    ]);
  });
});

describe("mapCommandToAsapSkill", () => {
  const cases: [RuntimeCommand, string][] = [
    [
      {
        action: "navigate",
        sessionId: "s",
        url: "https://a.com",
      },
      "browse_page",
    ],
    [{ action: "snapshot", sessionId: "s" }, "browse_page"],
    [
      {
        action: "click",
        sessionId: "s",
        selector: "#x",
      },
      "perform_flow",
    ],
    [
      {
        action: "type",
        sessionId: "s",
        selector: "#x",
        text: "hi",
      },
      "perform_flow",
    ],
    [{ action: "closeSession", sessionId: "s" }, "capture_artifact"],
  ];

  it.each(cases)("maps %j -> %s", (cmd, skill) => {
    expect(mapCommandToAsapSkill(cmd)).toBe(skill);
  });
});

describe("createAsapTaskEnvelope", () => {
  it("wraps command with conversation_id and skill_id", () => {
    const command: RuntimeCommand = {
      action: "navigate",
      sessionId: "s",
      url: "https://example.com",
    };
    const env = createAsapTaskEnvelope(command);
    expect(env.skill_id).toBe("browse_page");
    expect(env.input).toEqual(command);
    expect(env.conversation_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe("createBrowserGatewayDescriptor", () => {
  it("normalizes base URL and sets URN", () => {
    const d = createBrowserGatewayDescriptor("https://host/");
    expect(d.urn).toBe(BROWSER_GATEWAY_URN);
    expect(d.endpoint).toBe("https://host/asap");
    expect(d.skills).toBe(ASAP_BROWSER_SKILLS);
  });
});
