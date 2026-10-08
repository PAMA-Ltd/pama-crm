import { auth } from "@clerk/nextjs/server";
import { verifyClerkToken } from "@clerk/mcp-tools/next";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

type VerifiedOAuth = {
  tokenHash: string;
  userId: string;
};

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function authenticateOAuthBearer(token: string): Promise<VerifiedOAuth | null> {
  // Clerk verifies signature, expiration and revocation on every request.
  // This intentionally rejects browser-session JWTs and arbitrary Bearer tokens.
  const clerkAuth = await auth({ acceptsToken: "oauth_token" });
  const info = verifyClerkToken(clerkAuth, token);
  const userId = info?.extra?.userId;
  if (typeof userId !== "string" || !info?.clientId || !Array.isArray(info.scopes)) return null;

  if (!info.scopes.some((scope) => ["crm:read", "crm:write", "crm:admin"].includes(scope))) {
    throw new Error("The OAuth client has no CRM scope. Reconnect with crm:read, crm:write or crm:admin.");
  }

  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const bridgeSecret = process.env.CRM_MCP_OAUTH_BRIDGE_SECRET;
  if (!url || !bridgeSecret) throw new Error("OAuth bridge environment is not configured.");
  const tokenHash = await sha256Hex(token);
  const client = new ConvexHttpClient(url);
  await client.mutation(
    makeFunctionReference<"mutation", {
      bridgeSecret: string;
      tokenHash: string;
      userSubject: string;
      clientId: string;
      scopes: string[];
    }, { expiresAt: number; permission: "read" | "write" | "admin" }>("mcpOAuth:upsertSession"),
    { bridgeSecret, tokenHash, userSubject: userId, clientId: info.clientId, scopes: info.scopes },
  );
  return { tokenHash, userId };
}
