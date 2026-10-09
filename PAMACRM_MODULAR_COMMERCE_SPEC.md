# PamaCRM — Modular Business Profiles, Lifecycle CRM, and Commerce Event Integration

> Implementation brief / source of truth for the next engineering agent.
>
> Repository: PAMA-Ltd/pama-crm  
> Base branch for implementation: staging  
> Date: 2026-10-09  
> Status: Approved architecture and intended product behavior; **not a claim of implemented functionality**.
>
> **Do not interpret the business-profile selector as a permanent business type.** This document intentionally resolves that misunderstanding.

## 0. Meherah issues and PR linking — read first

| Identifier | Project | Work |
| --- | --- | --- |
| **LDT-48** | **PamaCRM** | Add Lifecycle module and secure Events API to PamaCRM |
| **LDT-49** | **PamaCRM** | Add workspace presentation presets and vocabulary layer |
| **LDT-47** | **Pamastore** | Publish Pamastore lifecycle events to PamaCRM |

**PR instructions:**

- In this PamaCRM repository, implementation PRs for the Lifecycle/Event API should refer to **LDT-48**; PRs for the workspace/presentation layer should refer to **LDT-49**. Mention both if a genuinely shared PR spans both scopes.
- In the separate Pamastore repository, event-producer PRs should refer to **LDT-47**.
- Put literal issue identifiers in **PR title and/or description** so Meherah's GitHub integration can associate work. Examples: "[LDT-48] Build secure lifecycle event ingestion" and "Implements LDT-48; related to LDT-47." Use **LDT-49** for the presentation PR.
- Never claim to close an issue merely by mentioning it in documentation. Close or transition it when the corresponding code is actually reviewed, merged, and verified; follow the project's existing Meherah/GitHub workflow.
- Avoid duplicate work: old overlapping notes/issues may exist; the three identifiers above are the agreed handoff targets. Verify active issue state before opening implementation PRs.
- Recommended workflow: inspect staging, branch from staging, implement in small reviewable slices, validate only relevant changes, PR **back to staging**, QA/review before merging. Do not automatically deploy or merge into main.

## 1. Why this exists

PamaCRM currently has multi-organization support, but its navigation and domain language are primarily sales-oriented:

- Companies
- Contacts
- Deals/Deal board
- Pipelines and forecasting
- Activities
- Email sequences

That works well for a B2B sales team or services agency, but does not describe the everyday job of a commerce operator running Pamastore. A Pamastore admin expects **buyers, sellers, lifecycle events, segments, campaigns, and automations**. A Track admin will eventually care about **users, subscriptions, trials, activity, and churn**, not forced sales deals.

**Multi-organization isolation does not equal business-specific product experience.**

Our decision: **one shared, secure CRM platform with optional modules and reversible workspace presentation presets**. Each organization can have different modules, vocabulary, navigation, dashboards, and automation templates *without forking the application or its underlying authorization and data model*.

### Non-negotiable correction to prior agent wording

Some descriptions say: "When creating an organization, select its business type." That is fine as **onboarding copy only if it is clear the choice is a starting template**, not a permanent business classification.

**Preferred UI wording:**

- Heading: **"How will you use PamaCRM?"**
- Hint: **"Choose a starting workspace. You can change this and customize modules later."**
- Choices: Sales / Commerce / SaaS / Services / Education / Custom (or General).
- Settings: **"Workspace layout"** or **"Workspace preset"**, not a restrictive permanent "business type."
- Independent controls: **Enabled modules**, **Navigation**, **Labels**, **Dashboard**.

Do **not**:
- add non-nullable permanent organization.type with branches of application behavior everywhere;
- create separate CRM products or duplicate Contacts/Companies tables per preset;
- hardcode Pamastore/Track names into common services;
- infer that changing presets should delete or migrate business data;
- hide unauthorized features only in the sidebar while retaining unprotected queries or mutations.

An organization may be Commerce today and later enable the Sales module or use a hybrid layout. All configurations must remain editable by permitted admins.

## 2. Desired product model

### 2.1 Shared core (every workspace)

- Organizations, membership, teams, role-based authorization, workspace switching.
- People/contacts and contact identities, activity timeline, notes, tasks.
- Integration/connection management, audit/security, basic reporting.
- Module registry/configuration, feature access checks, shared UI primitives.
- Existing B2B features remain available to organizations using them.

### 2.2 Optional modules (feature bundles, not separate products)

| Module | Typical surface | Notes |
| --- | --- | --- |
| Sales | Companies, Deals, Pipelines, Forecast | Existing CRM model; do not regress |
| Lifecycle | Customer profiles, Events, Segments | Cross-industry foundation |
| Campaigns | Audiences, Templates, Campaigns, Delivery logs | Marketing consent and suppression required |
| Automations | Triggers, Conditions, Wait, Actions, Run history | Can use existing email pipeline safely |
| Commerce (future richer entity adapters) | Buyers, Sellers, Orders, Product events | Generic event contracts initially; do not mirror all commerce tables into CRM |
| Support (future) | Tickets, conversations, support tasks | Separate follow-on module if required |

Some UI surfaces may be grouped for convenience; internal modules need not match every sidebar item one-to-one. Prefer capabilities with narrow rights and reusable domain primitives. Changing layout/preset must never change which data the user is permitted to access.

### 2.3 Initial workspace presets

Presets are **data-driven defaults** used to recommend modules, labels, sidebar items, home page and dashboard widgets. They should be reusable and reversible.

| Preset | Default language/navigation emphasis | Typical product |
| --- | --- | --- |
| Sales/B2B | Companies, Contacts, Deals, Pipelines, Forecast | Sales team |
| Commerce | Customers, Sellers, Segments, Campaigns, Automations, Events | Pamastore |
| SaaS | Users, Trials, Subscriptions, Engagement, Churn/Retention | Track |
| Services | Clients, Leads, Proposals, Deals, Projects/Activities | Agency/client businesses |
| Education | Students, Enrollments, Cohorts, Follow-ups, Renewals | Vasta/learning platform |
| Custom/General | Start with minimal core; administrator chooses modules | Mixed businesses |

**Only Commerce + Sales/B2B need complete product polish in the first deliverable.** The other presets may be configurable seeds/placeholders, and must not display unsupported features as working. New domain functionality for SaaS/Education is future implementation, not a claim that it exists now.

**Pamastore recommended configuration:** Commerce layout, core + Lifecycle + Campaigns + Automations; allow Sales to be enabled separately for partnerships if desired.

**Track recommended configuration:** SaaS layout when eventually supported; keep it a profile decision, not a schema split.

### 2.4 Presentation vocabulary and semantics

A label is not a new entity:

- Sales "Contacts" -> Commerce "Customers" may use the same core person/contact model.
- "Sellers" is a **role or relationship of a person/account**, not a simple alias for all companies. Model multiple roles on one person where relevant.
- "Orders" are **business event references/projections** in the MVP; Pamastore remains the system of record for order transactions.
- "Deals" must never be silently renamed to "Orders"; they have different semantics.
- "Subscription" must not be implemented by renaming "Deal" without an explicit data model.

Define a typed configuration and centralized metadata map (e.g. nav IDs, display labels, route requirements, permission requirements, dashboard widget IDs). Page headers, breadcrumbs, empty states, onboarding text, and search labels should follow the selected vocabulary consistently. Do not rely on scattered string checks like if preset === "commerce" throughout unrelated components.

### 2.5 Workspace lifecycle

1. New organization defaults to safe core configuration, with optional guided "How will you use PamaCRM?" selection.
2. Admin chooses preset. System proposes module and UI defaults.
3. Admin can independently enable/disable eligible modules and customize visible navigation.
4. The saved preferences persist **per organization**, across devices/team members.
5. Switching organizations immediately loads that organization's configuration; no bleed across tabs/workspaces.
6. Changing preset must confirm the proposed layout changes and **preserve existing records, integrations, permissions and automation state**. Disabling an automation module must prevent scheduled execution in a defined and testable way; no hidden sends.
7. Existing organizations must receive a backwards-compatible **Sales/B2B default** and keep working without a migration prompt that blocks access.

## 3. Architecture and existing repository touchpoints

The actual current main branch was inspected when preparing this brief. It has Next.js 16, React 19, Tailwind v4, Convex, Clerk, a multi-org backend, organization membership checks, existing outbound Mailjet-based sequence infrastructure, and OAuth/MCP tooling. Root README text about some demo data may be stale; **inspect code and tests as the source of truth**.

Relevant starting locations (verify current staging after branching):

- convex/schema.ts: organizations, organizationMembers, contacts, companies, deals, activities, emailSequences, sequenceEnrollments, emailEvents, MCP token/audit schema.
- convex/organizations.ts, convex/authz.ts: workspace creation and membership/owner/admin access.
- components/crm/workspace-provider.tsx: selected organization state.
- components/crm/workspace-onboarding.tsx, components/settings/settings-page.tsx: onboarding/settings.
- components/_common/sidebar/sidebar-content.tsx: currently sales-first fixed menu.
- app/(crm)/*: actual CRM page routes.
- convex/crons.ts and convex/mcpMail.ts: existing opted-in sequence sending and scheduling; **do not bypass global outbound safety switches**.
- app/api/mcp/route.ts, lib/mcp/tools.ts, convex/mcpOAuth.ts, convex/mcpTokens.ts: existing MCP auth. Product event integration credentials are a **different machine-to-machine trust model**, not a user OAuth login.
- docs/mcp-setup.md: current optional Mailjet/automation configuration.

Suggested server-side persistence:

- Add **organizationSettings** keyed/indexed by organizationId (or backwards-compatible optional fields on organizations, if simpler). Store preset ID, enabled module IDs, overrides, config version, updatedAt/by. Reads and writes require workspace membership/admin as appropriate.
- Separate **integrationClients** for trusted product producers (organization, source/application ID, staging/production environment, allowed event names, credential hash/key ID, created/revoked/rotated timestamps and quotas).
- Separate **lifecycleProfiles** / **externalIdentities** (organization, source, external user ID; optional mapped contact ID; role tags; profile attributes and marketing preferences).
- Append-style **lifecycleEvents** (organizationId, source/integration, environment, eventId, type, occurredAt, receivedAt, profile/identity, whitelisted properties, processing status). Build compound indexes for dedup, profile timeline, time-based event browsing.
- **segments**, **segment membership** or reusable evaluated predicates; **templates**, **campaigns**, **automationDefinitions**, **automationRuns**, **message attempts/receipts**, **consent/suppression records** as implementation phases warrant.
- Index by organization and relevant time/status. Avoid unbounded Convex table scans. Ensure deterministic idempotency in mutations, including concurrent retries.

Use migrations/default fallbacks for existing organizations. New module configuration must not change existing MCP permissions or break Sales queries.

## 4. Feature A — secure generic Events API (PamaCRM; LDT-48)

### 4.1 Intent

Pamastore and, later, Track/Vasta/PamaOS explicitly publish meaningful lifecycle events to PamaCRM. PamaCRM **does not directly poll/read the product's Convex database**. PamaCRM owns customer communication state and derived lifecycle profiles; the product owns transactional truth.

A clear separation:

~~~
Pamastore action / Convex state transition
  -> durable outbox or equivalent scheduled delivery
  -> authenticated PamaCRM Events API
  -> validate and persist once
  -> resolve a lifecycle identity/profile
  -> update projections/segment eligibility
  -> queue automation triggers
  -> governed email / task / campaign actions
~~~

Never block checkout, login, seller verification, payment confirmation, or order completion because the CRM is unavailable.

### 4.2 Transport contract (proposed v1)

Expose a versioned machine-to-machine endpoint such as POST /api/events/v1. The precise route should follow repo routing conventions and be documented; **/api/events/v1 is a target interface, not something known to be live**.

Required protections:

- Integration credentials are **created and managed within the target organization**. Credential resolves organization, source and environment; do not trust a caller-supplied organization ID/slug as authorization.
- Authenticate with a scoped integration credential and/or HMAC signature (prefer HMAC with timestamp + digest of raw body for replay protection). Do not leak credentials in query strings, client bundles, URL logs, crash traces, or plaintext database fields.
- Scope to organization **and staging/production**; separate tokens and data boundaries. Integration is revocable/rotatable. Limit allowed event types and payload sizes, enforce basic rate limits and structured errors.
- Verify request signature before accepting PII. Use authenticated server-side route/Convex action design; do not introduce publicly callable Convex mutations that can impersonate integrations.
- Schema-validate exact fields, event name, timestamp windows, allowed property types, and max sizes. Reject ambiguous/malformed data clearly.
- Idempotent uniqueness on (organization, environment, source, eventId). The same event repeated returns accepted/duplicate without retriggering actions; a reused eventId with different content should produce a detectable conflict.
- Acknowledge only after a durable acceptance record exists; processing can run asynchronously.
- Record sanitized reception/delivery audit with source, environment, event type, processing state and error codes. Never log secrets, full request bodies, sensitive identity documents or unnecessary customer PII.
- Workspace membership/RBAC and archived workspace state must be enforced on UI reads, credential issuance, status changes, and access to event history.

Example event (illustrative only; adapt validator as needed):

~~~json
{
  "eventId": "pamastore:order_123:delivered:v1",
  "type": "order_delivered",
  "occurredAt": "2026-10-09T10:00:00Z",
  "identity": {
    "externalUserId": "usr_abc123",
    "email": "buyer@example.com",
    "firstName": "Ada",
    "roles": ["buyer"]
  },
  "properties": {
    "orderId": "order_123",
    "amountMinor": 1450000,
    "currency": "NGN",
    "sellerId": "seller_xyz"
  }
}
~~~

Interpret money as integer minor units with explicit currency. Avoid embedding order line item addresses, ID documents, full card information, or other unnecessary PII. Consider an event schemaVersion and stable client/source namespace in the authenticated integration rather than trusting payload fields.

Proposed reply:

~~~json
{"accepted": true, "duplicate": false, "eventId": "pamastore:order_123:delivered:v1"}
~~~

Provide safe, documented errors for unauthorized, invalid, throttled, replay, and conflicting duplicate requests. No anonymous ingestion.

### 4.3 Initial Pamastore event vocabulary (shared contract with LDT-47)

| Event | When emitted | Key references | Candidate lifecycle use |
| --- | --- | --- | --- |
| user_signed_up | Account created and committed | externalUserId, role/email if known | Onboarding welcome (subject to category/consent) |
| seller_registered | Seller onboarding starts/completes registration | seller/user IDs, verification state | Seller onboarding journey |
| seller_verified | Verification transitions to approved | seller/user ID, state | Stop verification reminders, seller guidance |
| product_published | Product becomes live | productId, sellerId | Seller activation signal |
| order_created | New order persisted | orderId, customerId, currency/amount | Funnel analysis, transactional workflow if required |
| order_paid | Confirmed payment transition | orderId, payment status | Post-purchase flow; never infer payment from client-only UI |
| order_delivered | Delivery confirmed | orderId, customer/seller references | Review request after delay |
| order_cancelled | Cancellation committed | orderId, reason category | Suppress incompatible post-purchase messages |
| cart_abandoned | Derived after inactivity window, not a click | cartId/customerId, lastActivityAt | Permission-aware recovery |
| customer_inactive | Derived inactivity threshold met | customerId, lastOrderAt | Retention segment |
| seller_inactive | Derived inactivity threshold met | sellerId, lastProduct/engagementAt | Seller activation segment |

Track versioned event naming, authoritative state transitions, and an allowlist. For cart abandonment and inactivity, define exactly who computes the timer and how false positives/re-entry are prevented. Do not manufacture events directly from page visits without a stable business definition.

### 4.4 Identity matching and duplicate prevention

- Use (orgId, source/application, externalUserId) as the primary durable link. Support identities without email (guest buyers) and mutable email.
- Reconcile verified email/phone carefully; do not auto-merge two different customer accounts based on unverified email or a shared device.
- A customer may have multiple roles (buyer and seller). Role belongs on identity/profile relationship, not a duplicate Contacts record.
- Map to existing contacts when safely possible; never require a B2B company or deal to create a lifecycle profile.
- Process late/out-of-order events using occurredAt and stable transition/version semantics, not naive "last received wins".
- Provide profile event timeline that an authorized workspace member can inspect.

### 4.5 Ingestion acceptance criteria

- Correct org/environment accepted; incorrect or revoked credential rejected.
- Cross-tenant credential cannot read/write another org's events even with forged IDs/slug.
- Duplicate event delivered 2+ times yields exactly one stored logical event and one automation trigger.
- Conflicting duplicate ID is reported and audited, not silently overwritten.
- Valid event accepted with external identity and no preexisting company/contact.
- Bad schema, oversized data, expired signature, replay and unauthorized origin are rejected.
- Events are queryable via paginated/safely scoped Events view, with basic status/audit.
- A failed downstream automation never forces a producer to resend or mutates an order.
- Existing MCP OAuth and user tokens continue to operate as before.

## 5. Feature B — Pamastore producer/integration (Pamastore repo; LDT-47)

The implementation for this section lives in **the Pamastore repository**, not PamaCRM. The PamaCRM agent defines/contracts the shared interface and can build a test publisher/fixture, but should not mark LDT-47 complete until Pamastore actually emits real events.

- Identify **real** server-side transitions in Pamastore's Convex mutations/actions; do not depend on client navigation/UI to infer paid/delivered/verified states.
- Persist or durably schedule outbox records in the same business transition wherever possible; deliver asynchronously via Convex scheduled action/appropriate retry worker, without blocking primary mutation.
- Include stable event IDs, timestamp, schemaVersion, source environment and minimal identity references.
- Store endpoint and credential in **Pamastore server-side Convex environment**, separate staging/prod, never NEXT_PUBLIC.
- Use bounded exponential backoff with jitter for transient failures, and quarantine/dead-letter after max attempts. Do not retry 4xx credential/payload errors endlessly; surface operator-actionable diagnostics.
- Redrive must preserve event ID; PamaCRM dedup handles repeated delivery.
- Expose delivery health/last success/last failure without exposing customer secrets.
- Integration smoke test: staged Pamastore event becomes visible **only** in staged Pamastore PamaCRM workspace/integration, with duplicate resend accepted once. Test order flow still succeeds when CRM endpoint is intentionally unavailable.
- Do not turn on live bulk email simply by connecting the event stream.

Proposed server-side values (examples, not credentials):

~~~
PAMA_CRM_EVENTS_URL=https://crm.pama.company/api/events/v1
PAMA_CRM_EVENTS_KEY=<server-side-per-environment-credential>
~~~

Confirm actual route, signature scheme and deployment values before integration. Keys must be managed through authorized production/staging secret channels and never committed. For the staging environment, use a separate approved target and credential.

## 6. Feature C — Lifecycle module and communication engine (PamaCRM; LDT-48)

### 6.1 Minimum useful experience

Inside a workspace with Lifecycle enabled, users should be able to:

1. Browse **Profiles/Customers**, see known roles and a readable event timeline.
2. Browse **Events** by type, source, time and ingest/processing status.
3. Define **Segments** using meaningful predicates (e.g. verified sellers without published products; customers with >=3 delivered orders; inactive buyers). Provide live counts or clearly dated materializations; no cross-workspace scope leaks.
4. Create reusable **Templates** for permitted message categories, with controlled variables, preview, and safe defaults.
5. Create **Campaigns** to selected audiences, with drafts, approval/test send, send/schedule, suppression enforcement, and audit.
6. Create **Automations** from events or time conditions with explicit trigger, filter, wait, action, cooldown/idempotency and stop conditions.
7. See **run/delivery history** and errors. Make status visible: draft, active, paused, completed/failed. Do not label Mailjet API acceptance as successful inbox delivery.

### 6.2 Example automations

~~~
WHEN seller_registered
WAIT 3 days
IF seller_verified is still false
AND no matching reminder has already been sent
SEND verification reminder (correct message category)
STOP when seller_verified is observed
~~~

~~~
WHEN order_delivered
WAIT 2 days
IF order has not been cancelled/refunded
AND profile is eligible for requested message category
SEND review request
~~~

~~~
WHEN customer becomes inactive for 30 days
IF marketing consent is present AND recipient is not suppressed
ADD to inactive-customer segment
SEND re-engagement campaign (respect frequency caps)
~~~

Do not assume generic onboarding and promotional emails are always transactional. Classify each template/automation based on content and applicable obligations.

### 6.3 Message categories and consent (critical)

**Transactional** examples: payment receipt, order status, necessary account/security notice.  
**Marketing** examples: discount/promotion, generalized recommendations, win-back offer.  
Some follow-ups (review requests/onboarding) may require careful classification based on message content and jurisdiction.

- Consent and preferences must be per identity/contact and workspace, with source and timestamp, purpose/channel, and proof where relevant.
- Keep an explicit suppression/unsubscribe list checked immediately before sending.
- Provide unsubscribe mechanisms for marketing messages, honor opt-outs, prevent re-enrollment after unsubscribe unless there is a lawful new permission.
- Respect applicable privacy and electronic marketing obligations, including Nigerian data protection rules when relevant. Have product/legal review before sending live bulk campaigns.
- Require explicit admin action/configuration to activate any sending. Existing Mailjet environment switches and safety mechanisms remain **off by default**; do not bypass them to satisfy a demo.
- Support testing with a small internal recipient set first; log provider acceptance separately from delivered/bounced/opened/clicked. Mark metrics unavailable if provider webhooks/tracking have not been configured.
- Prevent accidental campaign duplication, over-send, and overlapping journey triggers using enrollment/run idempotency, per-profile cooldowns, frequency caps, and a pause/kill switch.

### 6.4 Scope sequence (do not build an over-large unreviewable PR)

**Phase 1 — Foundation:** module settings + preset read path, credential model, secure versioned Events API, event storage/dedup, identity mapping, event inbox; no outgoing marketing.

**Phase 2 — Producer integration:** implement/verify Pamastore outbox delivery in its own repo; staged end-to-end tests; secure integration administration and delivery health.

**Phase 3 — Lifecycle basics:** profile timeline and segments, read-only event-derived metrics, template library, data protection/consent and suppression management.

**Phase 4 — Automation & campaigns:** defined triggers + conditions + delay/action state machine, safe scheduling, rate limits, draft approval, manual test sends, pause/retry and audit.

**Phase 5 — Analytics & generalization:** conversion/retention where trustworthy, aggregate counts, event adapters/presets for SaaS/education/services when real demand exists.

Do not conflate a demo rule builder with a reliable delivery engine. Strong backend checks take precedence over visuals.

## 7. Feature D — workspace presentation presets and navigation (PamaCRM; LDT-49)

### 7.1 Navigation design

**Sales/B2B workspace (existing behavior preserved):**

~~~
Overview
Companies
Contacts
Deals / Pipelines
Forecast / Reports
Activities
Email Sequences
Team
Settings
~~~

**Commerce workspace (Pamastore default target):**

~~~
Overview
Customers
Sellers
Segments
Campaigns
Automations
Events
Templates
Activities / Support follow-ups
Settings
~~~

These are desired navigation examples, **not an instruction to create empty links**. If a module is not ready, either omit its nav item or show a clearly labeled safe "coming soon" state only where product owner agrees. If an entity is surfaced in Commerce, its underlying semantics must be accurate (e.g. Sellers from role-tagged profiles).

Sales-only sections (Companies, Deals, Pipeline/Forecast) are hidden from the **default Commerce navigation**, not deleted from the database; if Sales is enabled for that workspace, those sections become available in a coherent secondary group.

### 7.2 Dashboard composition

- Commerce: total buyers, active sellers, registered/verified sellers, delivered orders (from accepted events), recent customer activity, campaign reach/delivery and automation health (only when corresponding modules are operational).
- Sales: lead pipeline, deal stage summaries, forecast, overdue activities.
- SaaS (later): active users, trials, conversions, churn, subscription health using appropriate event definitions.
- Missing integrations/data: elegant empty states with actionable setup guidance. **Never fabricate metrics** or infer revenue from incomplete event streams.

### 7.3 Settings and behavior

- Workspace Settings -> Workspace layout: preset chooser, enabled modules, nav preview, dashboard preview, customize labels where supported.
- Apply/reset-to-preset: show exactly what visible defaults will change, preserve data/integrations, and give admin a safe rollback.
- Org owners/admins can change organization configuration; ordinary members can view their workspace configuration but should not change it.
- Navigation and routes must both respect module availability and membership; server-side mutations and data queries remain protected by organization auth.
- Backward compatibility: all existing organizations look/function as Sales/B2B until an admin opts to change.
- Responsive and accessible: mobile sidebar/drawer, correct keyboard focus/ARIA, readable nav and flexible dense tables.

### 7.4 UI acceptance criteria

- Two organizations with different presets can be switched without page reload leaking prior org's dashboard records or labels.
- Pamastore Commerce navigation is customer-focused and no longer dominated by Companies/Deals.
- Sales workspace remains functionally unchanged when Lifecycle disabled.
- Enable Sales inside Commerce -> sales nav/routes work, with correct existing data, without conversion of lifecycle orders into deals.
- Preset change and module toggle persist across sessions and across team members.
- Non-admin cannot edit org preset; someone outside organization cannot read it.
- Hidden modules do not run background automations unexpectedly.

## 8. Testing and QA (mandatory, targeted)

Implement targeted validation, not unnecessary broad workflow runs. At minimum:

**Schema and compatibility**
- Existing organizations automatically default to Sales/B2B without data loss.
- Workspace settings authorization and persisted overrides work.
- Unrelated CRM operations (companies, contacts, deals, pipelines, sequences and MCP) still pass their relevant tests.

**Ingestion/security**
- Valid signed event, expired/replayed signature, revoked integration, disallowed type, malformed/oversized body.
- Staging vs production separation and cross-organization/forged ID isolation.
- Duplicate payload and duplicate eventId conflict.
- Parallel repeated delivery yields one logical acceptance and one downstream trigger.
- Guest/no-email identity and buyer+seller role.
- Safe audit logs without raw secrets/PII.

**Resilience**
- Source checkout/order state not blocked by CRM outage.
- Exponential retry and dead-letter can recover without double-sending.
- Event processing and automation runs remain idempotent across retries.
- Unsubscribed marketing contact never receives promotion; transactional and marketing rules remain distinct.
- Automation pause/disable and global outbound-off switch prevents sends.

**UI**
- Sales vs Commerce label/sidebar/dashboard navigation.
- Organization switching, mobile layout, inaccessible module/deep link behavior.
- Accessible empty/loading/error states.
- Unchanged existing Sales workflow and legacy MCP clients.

Record real commands, output, failure evidence, and exact commit SHA in PR. Run only tests relevant to the changed areas, plus essential typecheck/build where needed; conserve CI/Actions credits. QA should inspect the actual diff and security/data-integrity behaviors before a merge.

## 9. Definition of done / agent handoff

The handoff work is complete only when the agent:

1. Inspects the **current staging branch** and relevant files before implementing; treats this as a product specification, not evidence of code being live.
2. Breaks work into sensible independent PRs. Each PamaCRM PR references **LDT-48** and/or **LDT-49**. Producer work in Pamastore references **LDT-47**.
3. Adds durable org-scoped module/preset settings and safe defaults, without hard-coded immutable "business type."
4. Builds a secure generic source/environment-scoped event API with dedup, minimal PII, durable audit and identity resolution.
5. Verifies staging end-to-end from Pamastore before enabling automated sending.
6. Preserves existing Sales, Clerk/Convex auth, MCP OAuth, member authorization, Mailjet sequence behavior and production credentials.
7. Separates marketing from transactional communications, with consent/suppression and opt-in activation.
8. Provides documented staged setup and exact steps to create/revoke integration credentials.
9. Provides clear test/QA evidence and links PRs to the Meherah issues.
10. Leaves production untouched unless explicitly approved.

### Decisions already made (do not re-open without a concrete technical blocker)

- One modular multi-organization CRM, not multiple forked CRM products.
- Presets are **reversible starting layouts**, not permanent organization types.
- Modules can be independently enabled; changing presentation never erases data.
- Pamastore emits events; PamaCRM ingests; PamaCRM does not directly read Pamastore's database.
- Pamastore's Convex operations must not be blocked by CRM downtime.
- Event ingester should be general enough for later Track, Vasta and PamaOS integrations.
- PR integration should use the Meherah issue identifiers **LDT-47, LDT-48, LDT-49** with the correct repository/project scope.

### Open engineering decisions for agent to document, not silently guess

- Final canonical route shape and HMAC vs dedicated bearer-token approach (must meet scoped/revocable/no-secret-logging requirements).
- Which event identity attributes may be used for account matching (no unsafe merges).
- Segment materialization vs query-time evaluation (performance/consistency trade-off).
- Exact campaign/automation state machine and provider delivery receipt callbacks.
- Whether to create an independent outbox table or use a durable scheduler plus retry record in Pamastore.
- Appropriate retention/deletion policy and audience consent defaults by channel/jurisdiction.

If any proposed functionality is not implemented in the first increment, keep it explicitly identified as **planned**, not simulated or silently counted as done.
