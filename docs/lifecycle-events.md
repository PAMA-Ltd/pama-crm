# Lifecycle Events — staging API contract (LDT-130)

This first Lifecycle slice is **not production enabled** until QA approves and the
correct staging environment is provisioned. It builds on LDT-49's reversible
workspace module preference and precedes LDT-48's Segments/Campaigns/Automations.

## Secure setup

1. Deploy the matched Next.js branch and Convex schema/functions into an isolated
   **nonproduction** environment. Never point a preview at the production
   Convex backend.
2. Set `CRM_LIFECYCLE_BRIDGE_SECRET` to the **same independently generated
   random value of at least 32 characters** in Vercel server environment
   and the matching Convex deployment. Do not reuse OAuth or MCP secrets.
3. Set `CRM_LIFECYCLE_ENVIRONMENT=staging` in **both** Vercel and Convex for
   staging. Only set `production` during an explicitly approved production release.
   The Next route and Convex mutation both fail closed when unset/mismatched.
4. As owner/admin, enable the **Lifecycle** module in workspace layout.
5. Under Settings → Lifecycle event integrations, create a key for a specific
   source (`pamastore`, `track`, etc.) and environment. Copy it **once** and
   store only in the source product's **server-side** environment.
6. Rotate by creating a second key, switching the producer, then revoking the
   first; server-side validity is capped at 90 days (plus at most five minutes\n   of clock-skew tolerance). Do not put tokens into client JS.

## Endpoint

`POST /api/events` with `Authorization: Bearer pama_evt_<64-lowercase-hex>`
and `Content-Type: application/json`. 32 KiB maximum encoded body.

```json
{
  "organizationSlug": "pamastore",
  "source": "pamastore",
  "environment": "staging",
  "eventId": "order_123_paid_v1",
  "type": "order_paid",
  "subjectId": "customer_987",
  "occurredAt": 1791600000000,
  "email": "customer@example.test",
  "name": "Test Customer",
  "properties": { "orderId": "123", "currency": "NGN" }
}
```

- `eventId` must be unique per organization/source/environment. Exact retries
  return `{accepted:true,duplicate:true,eventId}`. Reuse of that ID with
  different content—including changed normalized email or name—rejects the mutation\n  with an HTTP 409 (no overwrite). Event rows store immutable email/name\n  snapshots separately from the mutable customer profile. Older rows without\n  snapshots fail closed on unverifiable identity changes.
- Identities are matched by `source + subjectId` **inside one organization**.
  An existing same-organization CRM contact may be linked by normalized email;
  event ingestion never creates a Sales contact automatically.
- Credentials are scoped to exactly one organization, source and environment.
  Revoked/expired credentials are rejected. Max 120 calls per 60-second window
  per credential; accepted and duplicate events are audited.
- `properties` must be a JSON object of at most 8 KiB. Do not send passwords,
  token material, payment credentials, or sensitive raw customer payloads.
- Machine events do **not** send email or execute marketing automation. Marketing
  consent/preferences, Segments, Templates, Campaigns, Automation rules,
  delivery retries and provider messaging are later phases.
- The published Pamastore emitter contract (LDT-47) must be verified against
  this endpoint before enabling integration. Do not assume source compatibility.

## Testing/QA

Run clean npm ci, node tests, TypeScript, lint and production build using dummy
**public-only** variables. Independently deploy to nonproduction Convex and
exercise real Clerk owner/admin/member/nonmember sessions and cross-org event
isolation; ensure source prod/staging keys cannot cross environments, revoked
keys fail, retries dedupe, contact/profile links do not cross organizations.
This phase must not be promoted until QA validates those live checks.
