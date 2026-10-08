import { authenticateOAuthBearer } from "@/lib/mcp/oauth";
import {
  MCP_TOOLS,
  authenticateMcpToken,
  callMcpTool,
} from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

const SUPPORTED_PROTOCOLS = [
  "2026-07-28",
  "2025-11-25",
  "2025-06-18",
] as const;

function jsonRpc(
  id: JsonRpcRequest["id"],
  result: unknown,
  status = 200,
  protocolVersion?: string,
) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  if (protocolVersion) {
    headers.set("MCP-Protocol-Version", protocolVersion);
  }
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      result,
    }),
    { status, headers },
  );
}

function jsonRpcError(
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
  status = 200,
) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function readBearer(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLocaleLowerCase() !== "bearer" || !token) return null;
  return token;
}

function unauthorized(request: Request, message: string) {
  const resourceMetadata = new URL(
    "/.well-known/oauth-protected-resource/api/mcp",
    request.url,
  ).toString();
  return Response.json({ error: message }, {
    status: 401,
    headers: {
      "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadata}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function chooseProtocol(requested?: unknown) {
  if (
    typeof requested === "string" &&
    SUPPORTED_PROTOCOLS.includes(
      requested as (typeof SUPPORTED_PROTOCOLS)[number],
    )
  ) {
    return requested;
  }
  return SUPPORTED_PROTOCOLS[0];
}

async function handle(request: Request) {
  const token = readBearer(request);
  if (!token) return unauthorized(request, "OAuth sign-in or a Pama CRM MCP bearer token is required.");

  let tokenHash: string;
  if (token.startsWith("pama_mcp_")) {
    // Existing personal access tokens continue to work unchanged.
    tokenHash = await sha256Hex(token);
    try {
      await authenticateMcpToken(tokenHash);
    } catch {
      return unauthorized(request, "Invalid or revoked Pama CRM MCP token.");
    }
  } else {
    try {
      const oauth = await authenticateOAuthBearer(token);
      if (!oauth) return unauthorized(request, "Invalid or expired Clerk OAuth access token.");
      tokenHash = oauth.tokenHash;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("The OAuth client has no CRM scope")) {
        return Response.json({ error: error.message }, { status: 403 });
      }
      // Fail closed without exposing backend secrets, identity, or sensitive details.
      console.error("Pama CRM MCP OAuth verification or bridge failed:", error instanceof Error ? error.name : "unknown");
      return unauthorized(request, "OAuth authentication failed; check CRM OAuth configuration.");
    }
  }

  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "Parse error", 400);
  }

  if (body.jsonrpc !== "2.0" || !body.method) {
    return jsonRpcError(body.id, -32600, "Invalid Request", 400);
  }

  const protocolVersion = chooseProtocol(
    body.params?.protocolVersion ??
      request.headers.get("mcp-protocol-version") ??
      undefined,
  );

  if (body.method === "initialize") {
    return jsonRpc(
      body.id,
      {
        protocolVersion,
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: {
          name: "pama-crm",
          title: "Pama CRM",
          version: "1.0.0",
          description:
            "Multi-organization CRM tools for companies, contacts, deals, activities, pipelines, sequences and reporting.",
        },
        instructions:
          "Call list_organizations first when the user has not named a workspace. Use the returned organization slug in all organization-scoped tools. Never guess a slug or mix records across organizations.",
      },
      200,
      protocolVersion,
    );
  }

  if (body.method === "notifications/initialized") {
    return new Response(null, { status: 202 });
  }

  if (body.method === "ping") {
    return jsonRpc(body.id, {}, 200, protocolVersion);
  }

  if (body.method === "tools/list") {
    return jsonRpc(
      body.id,
      { tools: MCP_TOOLS },
      200,
      protocolVersion,
    );
  }

  if (body.method === "tools/call") {
    const name =
      typeof body.params?.name === "string" ? body.params.name : null;
    const args =
      body.params?.arguments &&
      typeof body.params.arguments === "object" &&
      !Array.isArray(body.params.arguments)
        ? (body.params.arguments as Record<string, unknown>)
        : {};

    if (!name) {
      return jsonRpcError(body.id, -32602, "Tool name is required.");
    }

    try {
      const result = await callMcpTool(name, args, tokenHash);
      const text = JSON.stringify(result, null, 2);
      return jsonRpc(
        body.id,
        {
          content: [{ type: "text", text }],
          structuredContent: result,
          isError: false,
        },
        200,
        protocolVersion,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tool call failed.";
      return jsonRpc(
        body.id,
        {
          content: [{ type: "text", text: message }],
          isError: true,
        },
        200,
        protocolVersion,
      );
    }
  }

  return jsonRpcError(body.id, -32601, "Method not found.");
}

export async function POST(request: Request) {
  return await handle(request);
}

export async function GET() {
  return new Response(
    JSON.stringify({
      name: "Pama CRM MCP",
      endpoint: "/api/mcp",
      transport: "Streamable HTTP / JSON response",
      authentication: "Bearer token",
    }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Allow: "POST, OPTIONS",
      },
    },
  );
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS" } });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, MCP-Protocol-Version",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
