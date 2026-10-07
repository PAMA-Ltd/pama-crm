# Pama CRM Full Workspace + MCP Design

## Goal

Turn the Kargul Studio CRM interface into a complete, real-data internal CRM for multiple Pama businesses, and expose the same CRM through an authenticated MCP endpoint at `/api/mcp` in the existing Next.js deployment.

## Organization model

An organization is a CRM workspace such as Pamastore, Vasta, PamaOS, or another business.

Every tenant-owned record belongs to exactly one organization. Organization membership determines access. A human-readable unique slug is the stable external identifier used by UI URLs, CSV imports, and MCP tools.

Core organization records:
- organizations
- organizationMembers
- organizationInvites
- teams
- pipelines

Existing legacy CRM rows remain valid during schema migration through optional organization fields. A one-time claim flow assigns legacy records into a chosen organization before the schema is tightened later.

## Restored Kargul interface

Restore the visible product areas from the original Kargul interface, but never restore fake records.

Primary:
- Companies
- Deals Board
- Forecast
- Activities
- Contacts
- Email Sequences

Team:
- dynamic real teams and members

Reporting:
- Quarter Forecast
- Slipping Deals

Pipelines:
- dynamic real pipelines for the active organization

Utilities:
- Notifications from real CRM activity
- Invite teammates using real organization invitations
- Help
- Workspace/billing/status panel backed by real organization metadata
- Real user/member profile drawers
- Company activity trend derived from activities
- Company score cards derived from CRM data

The original decorative sample names, counts, US phone numbers, fake owners, fake companies, and hardcoded score cards must not be reintroduced.

## CRM data

Companies:
- organization scoped
- create, update, delete with referential safeguards
- real owner membership
- segment and relationship tags
- pipeline metrics derived from deals
- activity trend derived from activities
- CSV export and bulk CSV import with preview, mapping, validation, duplicate reporting, and confirm step

Contacts:
- organization scoped
- create, update, delete
- company relationship
- unique normalized email within an organization
- owner/team where useful

Deals:
- organization scoped
- company required, contact optional
- pipeline required
- stage, value, probability, close date, notes
- changing stage writes a real activity
- company metrics recalculate after create/update/stage/delete/reassignment

Activities:
- organization scoped
- calls, emails, meetings, notes, tasks
- company/contact/deal relationships
- due/completed state
- overdue handling
- source field for human, system, or MCP writes

Email sequences:
- organization scoped
- real stored sequence definitions and steps
- draft/active/paused status
- contact enrollment records
- no fabricated sending state; outbound delivery remains inactive unless a mail provider is configured

## MCP

Endpoint: `/api/mcp` on the same Next.js deployment.

Use the official MCP TypeScript server SDK and Streamable HTTP.

Authentication:
- bearer access tokens issued from the CRM integrations UI
- store only SHA-256 token hashes in Convex
- tokens belong to a Clerk user subject, not one organization
- organization access is rechecked for every tool call against current memberships
- revoked tokens stop working immediately

Organization tools:
- list organizations
- get organization
- resolve organization by slug/name
- organization summary

CRM tools:
- list/search/get/create/update/delete companies
- bulk import companies
- list/search/get/create/update/delete contacts
- list/search/get/create/update/delete deals
- change deal stage
- list/create/update/delete/complete activities
- list/create/update/delete pipelines
- list teams/members
- list/create/update/delete email sequences
- enroll/unenroll contacts
- forecast summary
- slipping deals
- attention/today summary

Every mutating tool returns enough structured data to confirm exactly what changed.

## Security

UI Convex functions require Clerk authentication plus organization membership.

MCP functions validate the bearer token, resolve its user subject, then enforce the same organization membership rules.

No operation may trust an arbitrary organization id or slug without membership verification.

Owner/admin/member roles:
- owner: full workspace administration
- admin: CRM write access plus invites/team/pipeline management
- member: CRM read/write, no workspace deletion or token administration

## Deployment

Single Next.js app. Single Vercel project. Convex remains the backend.

`crm.pama.company/api/mcp` is live whenever the website deployment is live.

The Convex schema/functions must deploy before a frontend version that depends on them is promoted.

## Verification

Before merge:
- Convex local deployment accepts schema/functions
- TypeScript passes
- ESLint has zero product-code errors
- Next production build passes
- MCP initialize/tools/list/tool-call smoke tests pass
- organization isolation tests pass
- CSV parser/import validation tests pass
- core deal metric tests pass
- no primary restored UI control is dead or backed by fake data
