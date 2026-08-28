import { describe, expect, it } from "vitest";
import { assertAllowedNavigateUrl } from "./navigate-url.js";

describe("assertAllowedNavigateUrl", () => {
  it("allows public http and https targets", () => {
    expect(() =>
      assertAllowedNavigateUrl("https://example.com/path"),
    ).not.toThrow();
    expect(() => assertAllowedNavigateUrl("http://example.org")).not.toThrow();
  });

  it("does not treat public hostnames as IPv6 unique-local prefixes", () => {
    expect(() => assertAllowedNavigateUrl("https://fd.com")).not.toThrow();
    expect(() =>
      assertAllowedNavigateUrl("https://fcbarcelona.com"),
    ).not.toThrow();
  });

  it("rejects file and non-http schemes", () => {
    expect(() => assertAllowedNavigateUrl("file:///etc/passwd")).toThrow(
      "http or https",
    );
    expect(() => assertAllowedNavigateUrl("javascript:alert(1)")).toThrow(
      "http or https",
    );
  });

  it("rejects localhost, trailing-dot localhost, and private networks", () => {
    expect(() => assertAllowedNavigateUrl("http://localhost/admin")).toThrow(
      "not allowed",
    );
    expect(() => assertAllowedNavigateUrl("http://localhost./admin")).toThrow(
      "not allowed",
    );
    expect(() =>
      assertAllowedNavigateUrl("http://metadata.google.internal/"),
    ).toThrow("not allowed");
    expect(() =>
      assertAllowedNavigateUrl("http://foo.localhost/admin"),
    ).toThrow("not allowed");
    expect(() => assertAllowedNavigateUrl("http://127.0.0.1:8080")).toThrow(
      "not allowed",
    );
    expect(() => assertAllowedNavigateUrl("http://169.254.169.254/")).toThrow(
      "not allowed",
    );
    expect(() => assertAllowedNavigateUrl("http://192.168.1.1/")).toThrow(
      "not allowed",
    );
    expect(() => assertAllowedNavigateUrl("http://10.0.0.5/")).toThrow(
      "not allowed",
    );
    expect(() => assertAllowedNavigateUrl("http://172.16.0.1/")).toThrow(
      "not allowed",
    );
    expect(() => assertAllowedNavigateUrl("http://100.64.0.1/")).toThrow(
      "not allowed",
    );
    expect(() =>
      assertAllowedNavigateUrl("https://172.32.0.1/not-private"),
    ).not.toThrow();
  });

  it("rejects loopback IPv6 including bracketed and v4-mapped forms", () => {
    expect(() => assertAllowedNavigateUrl("http://[::1]/")).toThrow(
      "not allowed",
    );
    expect(() =>
      assertAllowedNavigateUrl("http://[::ffff:127.0.0.1]/secret"),
    ).toThrow("not allowed");
    expect(() => assertAllowedNavigateUrl("http://[fe80::1]/")).toThrow(
      "not allowed",
    );
    expect(() => assertAllowedNavigateUrl("http://[fc00::1]/")).toThrow(
      "not allowed",
    );
  });

  it("rejects unparseable urls", () => {
    expect(() => assertAllowedNavigateUrl("not a url")).toThrow("invalid");
  });
});
