import {
  generateClerkProtectedResourceMetadata,
  corsHeaders,
} from "@clerk/mcp-tools/server";

// Also served at the resource-specific RFC 9728 URL for MCP clients.
export function protectedResourceMetadata(request: Request) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return Response.json({ error: "Clerk is not configured." }, { status: 503 });
  const resourceUrl = new URL("/api/mcp", request.url).toString();
  const metadata = generateClerkProtectedResourceMetadata({
    publishableKey,
    resourceUrl,
    properties: { scopes_supported: ["crm:read", "crm:write", "crm:admin"] },
  });
  return Response.json(metadata, {
    headers: {
      ...corsHeaders,
      "Cache-Control": "public, max-age=300",
    },
  });
}

export function metadataOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
