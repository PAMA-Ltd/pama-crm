import assert from "node:assert/strict";
import test from "node:test";
import { toStructuredContent } from "../lib/mcp/structured-content.ts";

test("MCP structuredContent is always a plain JSON record", () => {
  const cases = [
    { input: [{ id: "organization-1" }], expected: { result: [{ id: "organization-1" }] } },
    { input: [], expected: { result: [] } },
    { input: { organizations: [{ id: "organization-1" }] }, expected: { organizations: [{ id: "organization-1" }] } },
    { input: {}, expected: {} },
    { input: null, expected: { result: null } },
    { input: undefined, expected: { result: null } },
    { input: true, expected: { result: true } },
    { input: 42, expected: { result: 42 } },
    { input: "ok", expected: { result: "ok" } },
  ];
  for (const { input, expected } of cases) {
    const actual = toStructuredContent(input);
    assert.deepEqual(actual, expected);
    assert.equal(Array.isArray(actual), false);
    assert.equal(typeof actual, "object");
    assert.notEqual(actual, null);
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
  }
});
