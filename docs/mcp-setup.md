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

Mailjet acceptance is not proof of mailbox delivery. The email log records accepted messages, not inbox success. Mailjet may accept a message even if the result/confirmation fails, so delayed retries should be reviewed for duplicates.

## Deployment
Deploy Convex schema/functions/crons first. Deploy Next.js front end afterward. Do not enable outbound until the deployment is verified. Never place Mailjet private keys in public Next.js environment variables.
