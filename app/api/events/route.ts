import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { normalizeLifecycleEvent } from "@/lib/lifecycle/event-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 32 * 1024;

function response(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const headerLength = Number(request.headers.get("content-length"));
  if (headerLength > MAX_BYTES) throw new Error("too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_json");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0, text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error("too_large");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try { return JSON.parse(text); } catch { throw new Error("invalid_json"); }
}

export async function POST(request: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const bridgeSecret = process.env.CRM_LIFECYCLE_BRIDGE_SECRET;
  const activeEnvironment = process.env.CRM_LIFECYCLE_ENVIRONMENT;
  if (!convexUrl || !bridgeSecret || bridgeSecret.length < 32 ||
      !["staging", "production"].includes(activeEnvironment ?? "")) {
    return response("Lifecycle event ingestion is not configured.", 503);
  }
  const match = /^Bearer (pama_evt_[a-f0-9]{64})$/.exec(request.headers.get("authorization") ?? "");
  if (!match) return response("Invalid integration credential.", 401);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return response("Expected application/json.", 415);
  }
  let event;
  try {
    event = normalizeLifecycleEvent(await readBoundedJson(request));
  } catch (error) {
    return response(error instanceof Error && error.message === "too_large"
      ? "Event body exceeds 32 KB." : "Invalid lifecycle event.", error instanceof Error && error.message === "too_large" ? 413 : 400);
  }
  if (event.environment !== activeEnvironment) {
    return response("Integration environment mismatch.", 403);
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(match[1]));
  const tokenHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.mutation(
      makeFunctionReference<"mutation",
        typeof event & { tokenHash: string; bridgeSecret: string },
        { accepted: boolean; duplicate: boolean; eventId: string }>("lifecycle:ingest"),
      { ...event, tokenHash, bridgeSecret },
    );
    return Response.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("rate limit exceeded")) return response("Integration rate limit exceeded.", 429);
    if (message.includes("already used for different content")) return response("Event ID conflicts with an existing event.", 409);
    if (message.includes("not configured")) return response("Lifecycle event ingestion is not configured.", 503);
    if (message.includes("Invalid integration credential") ||
        message.includes("workspace access denied") || message.includes("environment mismatch")) {
      return response("Integration authentication failed.", 401);
    }
    // Never reflect backend errors or request fields into HTTP responses or logs.
    return response("Event ingestion failed.", 503);
  }
}

export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
