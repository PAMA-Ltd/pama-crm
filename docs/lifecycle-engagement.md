# Lifecycle phase 2 — Segments, Campaigns, Automations

Stacked development on PR #8; **do not deploy or merge** before independent QA and isolated Clerk+Convex staging verification.

## Features and authorization

- Organization owners/admins create and edit **dynamic Segments** filtering by source, chronologically latest event type (occurredAt), and profile tag. Members can view and preview. Segment definitions are scoped by organization ID in both backend handlers and indexes.
- **Campaign drafts** store name, audience segment, subject and body. Owners/admins may edit/archive. Previews count matching profiles, suppressed profiles and consent-eligible profiles. **There is no dispatch/send operation** in this phase; mail delivery is explicitly disabled.
- **Automations** are safe server-side `tag_profile` rules: an active rule matches an incoming event type and optional source, and adds a tag to the matching organization's lifecycle profile. Activation is owner/admin-only and requires confirmation. Results are audited as tagged, already tagged, or skipped because the profile's 20-tag limit was reached. Duplicate eventId deliveries are not executed again; paused rules do nothing.
- **Consent** is not inferred from email, purchase, or registration. Only a signed `marketing_consent_updated` event with `properties: { "consent": "opt_in" | "opt_out" }` changes it. A new opt-in requires a known profile email. Older out-of-order consent changes cannot overwrite more recent consent. Unknown and opt-out profiles are suppressed.
- Segments are usable when the Lifecycle **or** Campaigns module is enabled. Campaigns and Automations each require their own enabled module. Organizations remain isolated even when modules or presets differ.

## Scale/safety

Dynamic audience previews scan at most 500 recent organization profiles (read 501 to detect truncation). They return `partial:true` when not exhaustive; **never use previews to determine a complete send list**. A pagination/materialization feature must be built before outbound campaigns. There are caps of 100 segments, 100 campaigns, 25 automations per organization and 20 tags per profile.

Marketing email, provider credentials, template rendering, unsubscribe endpoint, opt-out processing across destinations, send queues, message rate limits, delivery webhooks, and retries are **future work** and not implemented. Do not claim customer campaigns are deliverable or activate marketing sending.

## QA

Run focused Node handler/predicate tests for tenant/RBAC isolation, cross-org segment referencing, campaign draft lifecycle, unknown/opt-out suppression, opt-in/out event provenance, out-of-order handling, replay safe automations, pause/active behavior, and modules disabled. TypeScript, targeted lint and production build. Then perform real nonproduction Clerk/Convex browser and HTTP tests for PR #8 and this stacked PR. QA approval precedes merges.

**Important privacy detail:** If two consent events have the same source timestamp, the
previous decision wins; tied opt-in must not override an existing opt-out.
Out-of-order older events never reverse a newer choice. Opt-in without a known
profile email is rejected.

For preview eligibility, opted-out profiles suppress the same email across
different sources *within the same organization*, and shared addresses are
deduplicated. A changed email address does not inherit previous opt-in. These
are still bounded previews, **never** a send-ready list.

### Ordering and module dependencies

The last event type is determined by event `occurredAt`, not receipt time. The
first event wins if timestamps tie; older delayed deliveries cannot silently
change the audience. `lastSeenAt` still records ingestion time. Legacy profiles
without `lastEventOccurredAt` initialize the value on the next event.

Automations may be drafted with the Automations module alone, but **activation
requires Lifecycle to be enabled**. If Lifecycle is subsequently disabled,
incoming events are rejected and existing active rules are visibly **suspended**
until it is re-enabled. Pausing is still allowed while Lifecycle is off.
