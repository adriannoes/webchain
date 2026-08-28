const BLOCKED_EXACT_HOSTS = new Set(["localhost", "metadata.google.internal"]);

/**
 * Reject navigate/document URLs that can read local files or internal networks.
 *
 * @example
 * assertAllowedNavigateUrl("https://example.com/path");
 * // throws for "http://127.0.0.1/secret"
 */
export function assertAllowedNavigateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("invalid navigate url");
  }

  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (scheme !== "http" && scheme !== "https") {
    throw new Error("navigate url must use http or https");
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (isBlockedHostname(hostname)) {
    throw new Error("navigate url host is not allowed");
  }
}

function normalizeHostname(hostname: string): string {
  let host = hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  if (host.endsWith(".")) {
    host = host.slice(0, -1);
  }
  return host;
}

function isBlockedHostname(hostname: string): boolean {
  if (BLOCKED_EXACT_HOSTS.has(hostname) || hostname.endsWith(".localhost")) {
    return true;
  }
  if (hostname.includes(":")) {
    return isPrivateOrReservedIpv6(hostname);
  }
  return isPrivateOrReservedIpv4(hostname);
}

function parseIpv4Octets(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const value = Number(part);
    if (value < 0 || value > 255) {
      return null;
    }
    octets.push(value);
  }
  return octets;
}

function isPrivateOrReservedIpv4(host: string): boolean {
  const octets = parseIpv4Octets(host);
  if (octets === null) {
    return false;
  }
  const [a, b] = octets;
  if (a === undefined) {
    return false;
  }
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b !== undefined && b >= 64 && b <= 127) {
    return true;
  }
  return false;
}

function ipv4MappedFromIpv6(host: string): string | null {
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(host);
  if (dotted?.[1] !== undefined) {
    return dotted[1];
  }
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(host);
  if (hex?.[1] === undefined || hex[2] === undefined) {
    return null;
  }
  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}

function isPrivateOrReservedIpv6(host: string): boolean {
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") {
    return true;
  }
  const mappedIpv4 = ipv4MappedFromIpv6(host);
  if (mappedIpv4 !== null) {
    return isPrivateOrReservedIpv4(mappedIpv4);
  }
  const firstHextet = host.split(":")[0] ?? "";
  // Unique local fc00::/7 and link-local fe80::/10.
  if (firstHextet.startsWith("fc") || firstHextet.startsWith("fd")) {
    return true;
  }
  if (/^fe[89ab]/i.test(firstHextet)) {
    return true;
  }
  return false;
}
