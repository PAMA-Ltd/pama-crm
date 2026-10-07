# Pama CRM Full Workspace + MCP Implementation Plan

**Goal:** Restore the full Kargul CRM product surface with real multi-organization Convex data, add safe CSV import, and ship an authenticated MCP server at /api/mcp.

**Architecture:** Add an organization membership layer in Convex and scope every CRM record/query through it. The Next.js UI uses one active organization context; restored Kargul surfaces read from organization-scoped hooks. MCP uses bearer tokens mapped to a Clerk user subject and calls organization-scoped Convex MCP functions through the same deployment.

**Tech Stack:** Next.js 16, React 19, Convex, Clerk, official MCP TypeScript server SDK, Zod, Vitest.

**Spec:** docs/superpowers/specs/2026-10-07-pama-crm-full-workspace-mcp-design.md

## Global Constraints

- Keep one Next.js app; no Turborepo and no separate MCP deployment.
- No fake/demo CRM records in rendered UI.
- Preserve the Kargul visual system wherever practical.
- Every tenant record is organization scoped.
- MCP endpoint is /api/mcp on crm.pama.company.
- GitHub Actions are not required for validation; use isolated sandbox validation.

## Tasks

1. Add organization/membership/pipeline/team/invite/token schema and authorization helpers, with safe optional organization fields for existing rows.
2. Refactor Companies, Contacts, Deals and Activities functions to enforce organization scoping and complete CRUD.
3. Add organization selection/onboarding and restore dynamic sidebar sections.
4. Restore real notifications, owner/member profiles, activity trends, score cards, reporting and pipeline views.
5. Add email sequence definitions/enrollments backed by Convex.
6. Add CSV import parser, preview/mapping/validation UI, and batch import mutation.
7. Add MCP token management UI/API and /api/mcp Streamable HTTP server with comprehensive tools.
8. Add tests for isolation, calculations, CSV parsing and MCP tool behavior.
9. Regenerate Convex types, run Convex push, TypeScript, lint, tests and production build.
10. Open PR to main and merge only if all validation is green.
