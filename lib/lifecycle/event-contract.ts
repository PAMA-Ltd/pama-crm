/**
 * Small, explicit machine-to-machine event contract. Keep untrusted input and
 * property sizes bounded before a Convex mutation is called.
 */
export type LifecycleEnvironment = "staging" | "production";
export type LifecycleEventInput = {
  organizationSlug: string;
  source: string;
  environment: LifecycleEnvironment;
  eventId: string;
  type: string;
  subjectId: string;
  occurredAt: number;
  email?: string;
  name?: string;
  propertiesJson: string;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE = /^[a-z][a-z0-9_-]{1,63}$/;
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TYPE = /^[a-z][a-z0-9_.-]{1,95}$/;

export function normalizeLifecycleEvent(value: unknown, now = Date.now()): LifecycleEventInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an event object.");
  const row = value as Record<string, unknown>;
  const organizationSlug = String(row.organizationSlug ?? "");
  const source = String(row.source ?? "");
  const environment = row.environment;
  const eventId = String(row.eventId ?? "");
  const type = String(row.type ?? "");
  const subjectId = String(row.subjectId ?? "");
  if (organizationSlug.length > 64 || !SLUG.test(organizationSlug)) throw new Error("Invalid organizationSlug.");
  if (!SOURCE.test(source)) throw new Error("Invalid source.");
  if (environment !== "staging" && environment !== "production") throw new Error("Invalid environment.");
  if (!EVENT_ID.test(eventId)) throw new Error("Invalid eventId.");
  if (!TYPE.test(type)) throw new Error("Invalid event type.");
  if (!subjectId.trim() || subjectId.length > 128) throw new Error("Invalid subjectId.");
  const occurredAt = row.occurredAt === undefined ? now : row.occurredAt;
  if (typeof occurredAt !== "number" || !Number.isFinite(occurredAt) ||
      occurredAt > now + 5 * 60_000 || occurredAt < now - 90 * 86_400_000) {
    throw new Error("Invalid event timestamp.");
  }
  const email = row.email === undefined ? undefined : String(row.email).trim().toLowerCase();
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error("Invalid email.");
  }
  const name = row.name === undefined ? undefined : String(row.name).trim();
  if (name && name.length > 160) throw new Error("Invalid name.");
  const properties = row.properties ?? {};
  if (!properties || Array.isArray(properties) || typeof properties !== "object") {
    throw new Error("Event properties must be an object.");
  }
  const propertiesJson = JSON.stringify(properties);
  if (propertiesJson.length > 8192) throw new Error("Event properties exceed 8 KB.");
  return { organizationSlug, source, environment, eventId, type, subjectId: subjectId.trim(),
    occurredAt, email: email || undefined, name: name || undefined, propertiesJson };
}

export function validIntegrationSource(source: string): boolean {
  return SOURCE.test(source);
}
