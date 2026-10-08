import { makeFunctionReference } from "convex/server";

export type McpTokenRecord = {
  _id: string;
  label: string;
  tokenPrefix: string;
  createdAt: number;
  revokedAt?: number;
  expiresAt?: number;
  permission?: "read" | "write" | "admin";
  organizationId?: string;
};

export const listMcpTokens = makeFunctionReference<
  "query",
  Record<string, never>,
  McpTokenRecord[]
>("mcpTokens:listMine");

export const registerMcpToken = makeFunctionReference<
  "mutation",
  { label: string; tokenHash: string; tokenPrefix: string; permission?: "read" | "write" | "admin"; expiresAt?: number; organizationId?: string },
  string
>("mcpTokens:register");

export const revokeMcpToken = makeFunctionReference<
  "mutation",
  { tokenId: string },
  null
>("mcpTokens:revoke");
