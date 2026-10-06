import { makeFunctionReference } from "convex/server";

export type CrmAccessStatus = {
  authenticated: boolean;
  authorized: boolean;
  email: string | null;
};

export const getCrmAccessStatus = makeFunctionReference<
  "query",
  Record<string, never>,
  CrmAccessStatus
>("access:status");
