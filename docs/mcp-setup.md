# Pama CRM MCP operations

Endpoint: /api/mcp with a bearer token created under CRM Workspace Settings.

## Token policy
- Tokens can be read-only, read/write or admin, and may be restricted to the current workspace.
- Tokens expire and may be revoked. The endpoint enforces 120 calls/minute/token.
- Existing tokens retain legacy access until reissued. Reissue them with least privilege.
- Tool calls that modify data are recorded in the MCP audit log.

## Read scalability
Use page_companies, page_contacts, page_deals or page_activities with continueCursor until isDone=true to retrieve every record. Use search_all_companies, search_all_contacts and search_all_deals for indexed full-text name search. Legacy search tools return bounded first-500 slices.

## Outbound Mailjet mail (optional)
Add these to **Convex deployment environment**, not Vercel:
- MAILJET_API_KEY (Mailjet API public key)
- MAILJET_SECRET_KEY (Mailjet API private key)
- CRM_FROM_EMAIL (verified Mailjet sender)
- CRM_OUTBOUND_EMAIL_ENABLED=true (required for manual sending)
- CRM_AUTOMATION_ENABLED=true (required to enable scheduled email sequence sending)

All sending is OFF by default. The sequence cron checks every 15 minutes and only processes active sequences with active enrollments. Paused and cancelled enrollments are not sent. Manual send_contact_email requires confirmSend=true. Set the keys, verify a sender and test with a controlled contact before enabling CRM_AUTOMATION_ENABLED.

Mailjet acceptance is not proof of mailbox delivery. The email log records accepted messages, not inbox success. Failed or ambiguous sequence sends pause the enrollment for manual review instead of blindly retrying. After checking Mailjet delivery, resume with set_sequence_enrollment_status and confirmRetry=true. Manual email sends may still be accepted even when logging fails; check Mailjet before retrying.

## Deployment
Deploy Convex schema/functions/crons first. Deploy Next.js front end afterward. Do not enable outbound until the deployment is verified. Never place Mailjet private keys in public Next.js environment variables.


## Connect with OAuth (ChatGPT, Claude, Cursor, other MCP clients)

**URL:** `https://crm.pama.company/api/mcp`

Pama CRM supports **Clerk-issued OAuth 2.1 access tokens** alongside existing `pama_mcp_` personal tokens. The Next.js MCP route verifies Clerk OAuth tokens on *every request* and binds their verified Clerk user ID to the existing Convex organization authorization. No CRM data becomes public, and OAuth cannot bypass workspace membership.

### One-time server configuration

1. In **Clerk Dashboard → OAuth applications → Settings → Client onboarding**, enable **Publish CIMD support** (recommended for ChatGPT and modern MCP clients). Enable **Publish DCR support** only if you need compatibility with older clients; it exposes unauthenticated client registration. **Require PKCE** for all clients and keep the OAuth consent screen enabled.
2. Define **custom OAuth scopes** `crm:read`, `crm:write`, and `crm:admin` in Clerk. Set the **default scopes for dynamic clients** to `openid`, `profile`, `email`, and `crm:read`. OAuth clients must explicitly request `crm:write` for mutations or `crm:admin` for admin-only operations. Grant these scopes to registered clients as required. Do not grant admin by default. To allow unattended token refresh for compatible clients, enable the optional `offline_access` scope in Clerk.
3. Generate a high-entropy shared secret: `openssl rand -hex 32`. Set the **same value** as `CRM_MCP_OAUTH_BRIDGE_SECRET` in **Vercel Production** (sensitive type) and **Convex Production** (`npx convex env set CRM_MCP_OAUTH_BRIDGE_SECRET <value> --prod`). Do not commit this secret.
4. Deploy Convex functions/schema/crons before updating Next.js (`npx convex deploy`). Vercel's production build must run Convex deploy before Next.js build, as configured.
5. Ensure `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` are set correctly for the same production Clerk/Convex environments.

### Discovery and validation

- MCP endpoint: `https://crm.pama.company/api/mcp`
- Protected resource metadata: `https://crm.pama.company/.well-known/oauth-protected-resource/api/mcp` (also at the root RFC 9728 path)
- Authorization server metadata: `https://crm.pama.company/.well-known/oauth-authorization-server` (proxies Clerk's OAuth metadata)
- Unauthenticated MCP POST should return **401** with the correct `WWW-Authenticate: Bearer resource_metadata="..."` header, not a 500.
- Log in to ChatGPT with a CRM user via OAuth consent and confirm `list_organizations` only shows organizations belonging to that user. Test `crm:read` (read tools only), `crm:write` (mutations), `crm:admin` (admin operations). Repeat with a nonmember account. Existing `pama_mcp_` token clients must still work.
- An OAuth token with missing CRM scopes gets a 403; a missing/invalid/expired OAuth token gets a 401. OAuth sessions are short-lived Convex bridge records, refreshed only by newly verified Clerk requests, and cleaned hourly.
