import { describe, expect, it } from "vitest";
import { assertAllowedNavigateUrl } from "./navigate-url.js";

describe("assertAllowedNavigateUrl", () => {
  it("allows public http and https targets", () => {
    expect(() => assertAllowedNavigateUrl("https://example.com/path")).not.toThrow();
    expect(() => assertAllowedNavigateUrl("http://example.org")).not.toThrow();
  });

  it("rejects file and non-http schemes", () => {
    expect(() => assertAllowedNavigateUrl("file:///etc/passwd")).toThrow(
      "http or https",
    );
    expect(() => assertAllowedNavigateUrl("javascript:alert(1)")).toThrow(
      "http or https",
    );
  });

  it("rejects localhost and private networks", () => {
    expect(() => assertAllowedNavigateUrl("http://localhost/admin")).toThrow(
      "not allowed",
    );
    expect(() => assertAllowedNavigateUrl("http://127.0.0.1:8080")).toThrow(
      "not allowed",
    );
    expect(() => assertAllowedNavigateUrl("http://169.254.169.254/")).toThrow(
      "not allowed",
    );
    expect(() => assertAllowedNavigateUrl("http://192.168.1.1/")).toThrow(
      "not allowed",
    );
  });
});
