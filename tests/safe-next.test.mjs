import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNextPath } from "../src/lib/auth/safe-next.ts";

test("keeps ordinary internal destinations", () => {
  assert.equal(safeNextPath("/bookings/planning"), "/bookings/planning");
  assert.equal(safeNextPath("/annonces?foo=bar"), "/annonces?foo=bar");
});
test("rejects absolute and protocol-relative URLs", () => {
  for (const v of ["https://evil.example", "http://evil.example", "//evil.example", "\\evil.example", "", undefined]) {
    assert.equal(safeNextPath(v), "/", `Unexpected acceptance: ${String(v)}`);
  }
});
test("rejects encoded slash, backslash, and injection attempts", () => {
  for (const v of ["/%2fexample.com", "/%5cexample.com", "/\\evil.example", "/foo\r\nSet-Cookie:evil", "/foo%0abar", "/..//evil.example", "/%2e%2e//evil.example"]) {
    assert.equal(safeNextPath(v), "/", `Unexpected acceptance: ${v}`);
  }
});
