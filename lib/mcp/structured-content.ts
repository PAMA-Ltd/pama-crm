/**
 * MCP tools/call structuredContent MUST be a JSON object.
 * Convex can return arrays (e.g. list_organizations), scalars, or null.
 * Preserve record-shaped results and wrap every other shape consistently.
 */
export function toStructuredContent(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return { result: value === undefined ? null : value };
}
