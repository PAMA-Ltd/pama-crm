import { makeFunctionReference } from "convex/server";

export type LifecycleIntegration = {
  _id: string; source: string; environment: "staging" | "production";
  label: string; tokenPrefix: string; createdAt: number;
  expiresAt: number; revokedAt?: number;
};
export type LifecycleEventSummary = {
  _id: string; source: string; environment: "staging" | "production";
  eventId: string; type: string; profileId: string;
  occurredAt: number; receivedAt: number;
};

export const listLifecycleIntegrations = makeFunctionReference<"query", {organizationId: string}, LifecycleIntegration[]>("lifecycle:listIntegrations");
export const createLifecycleIntegration = makeFunctionReference<"mutation", {
  organizationId: string; source: string; environment: "staging" | "production";
  label: string; tokenHash: string; tokenPrefix: string; expiresAt: number;
}, string>("lifecycle:registerIntegration");
export const revokeLifecycleIntegration = makeFunctionReference<"mutation", {
  organizationId: string; integrationId: string;
}, null>("lifecycle:revokeIntegration");
export const listLifecycleEvents = makeFunctionReference<"query", {
  organizationId: string; limit?: number;
}, LifecycleEventSummary[]>("lifecycle:listEvents");

export type LifecycleIngressAudit = {
  _id: string; integrationId: string; eventId: string;
  outcome: "accepted" | "duplicate"; createdAt: number;
};
export const listLifecycleIngressAudit = makeFunctionReference<"query", {
  organizationId: string; limit?: number;
}, LifecycleIngressAudit[]>("lifecycle:listIngressAudit");
