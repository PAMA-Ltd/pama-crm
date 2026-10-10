/**
 * Pure lifecycle predicates shared by Convex functions and regression tests.
 * Never infer consent from profile email or from order/account events.
 */
export type SegmentFilter = {
  source?: string;
  lastEventType?: string;
  requiredTag?: string;
};
export type ProfileForSegment = {
  source: string;
  lastEventType?: string;
  tags?: string[];
  email?: string;
  marketingConsent?: "opt_in" | "opt_out";
};
export const isSource = (value: string) => /^[a-z][a-z0-9_-]{1,63}$/.test(value);
export const isEventType = (value: string) => /^[a-z][a-z0-9_.-]{1,95}$/.test(value);
export const isTag = (value: string) => /^[a-z][a-z0-9_-]{0,31}$/.test(value);

export function matchesSegment(profile: ProfileForSegment, filter: SegmentFilter): boolean {
  return (!filter.source || filter.source === profile.source) &&
    (!filter.lastEventType || filter.lastEventType === profile.lastEventType) &&
    (!filter.requiredTag || Boolean(profile.tags?.includes(filter.requiredTag)));
}
export function eligibleForMarketing(profile: ProfileForSegment): boolean {
  return profile.marketingConsent === "opt_in" && Boolean(profile.email);
}
export function consentFromEvent(type: string, propertiesJson: string): "opt_in" | "opt_out" | null {
  if (type !== "marketing_consent_updated") return null;
  const props: unknown = JSON.parse(propertiesJson);
  if (!props || typeof props !== "object" || Array.isArray(props)) {
    throw new Error("Consent event properties must be an object.");
  }
  const consent = (props as {consent?: unknown}).consent;
  if (consent !== "opt_in" && consent !== "opt_out") throw new Error("Consent event must specify opt_in or opt_out.");
  return consent;
}
export function nextTags(existing: readonly string[] | undefined, tag: string): string[] {
  if (!isTag(tag)) throw new Error("Invalid automation tag.");
  const tags = [...(existing ?? [])];
  if (tags.includes(tag)) return tags;
  if (tags.length >= 20) throw new Error("Profile tag limit reached.");
  return [...tags, tag];
}
