import type { RuntimeCommand } from "@webchain/protocol";

export const BROWSER_GATEWAY_URN = "urn:asap:agent:webchain:browser-gateway";

export const ASAP_BROWSER_SKILLS = [
  {
    id: "browse_page",
    description: "Navigate to a page and capture the first browser state.",
    supportedActions: ["navigate", "snapshot"],
  },
  {
    id: "perform_flow",
    description: "Execute browser actions that mutate the current page.",
    supportedActions: ["click", "type"],
  },
  {
    id: "capture_artifact",
    description: "Close out a flow and persist the final trace or snapshot.",
    supportedActions: ["snapshot", "closeSession"],
  },
] as const;

export function mapCommandToAsapSkill(command: RuntimeCommand) {
  switch (command.action) {
    case "navigate":
    case "snapshot":
      return "browse_page";
    case "click":
    case "type":
      return "perform_flow";
    case "closeSession":
      return "capture_artifact";
  }
}

export function createAsapTaskEnvelope(command: RuntimeCommand) {
  return {
    conversation_id: crypto.randomUUID(),
    skill_id: mapCommandToAsapSkill(command),
    input: command,
  };
}

export function createBrowserGatewayDescriptor(baseUrl: string) {
  return {
    urn: BROWSER_GATEWAY_URN,
    name: "webchain-browser-gateway",
    description: "Stable ASAP entrypoint for the Webchain browser runtime.",
    endpoint: `${baseUrl.replace(/\/$/, "")}/asap`,
    skills: ASAP_BROWSER_SKILLS,
  };
}
