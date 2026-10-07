# Pama CRM MVP Completion Design

## Intent

Complete the existing Pama CRM branch as a practical internal sales CRM for Pama. The goal is not to turn it into a SaaS platform. The app should let the team manage companies, contacts, opportunities, and follow-up work without demo-only UI or dead controls.

## Product scope

### Companies

Companies are the account-level record and the central place to understand a customer or prospect.

Required behavior:
- Create, edit, and delete a company.
- View a company detail workspace containing its profile, linked contacts, linked deals, and recent activities.
- Search, sort, filter, and export companies.
- Company pipeline metrics are derived from linked deals, not manually entered.
- Deleting a company is blocked while linked contacts, deals, or activities exist. The UI explains what must be removed or reassigned first.

### Contacts

Contacts represent real people.

Required behavior:
- Create, edit, and delete contacts.
- Link or unlink a contact from a company.
- View contact details, notes, linked company, linked deals, and recent activities.
- Search contacts.
- Prevent duplicate non-empty email addresses.
- Deleting a contact is blocked while a deal still references it.

### Deals

Deals represent commercial opportunities.

Required behavior:
- Create, edit, and delete deals.
- Each deal belongs to a company and may reference one contact.
- Edit name, amount, company/contact, expected close date, notes, and stage.
- Move deals between Lead, Qualified, Proposal, Negotiation, Won, and Lost.
- Stage changes update probability and append a CRM activity.
- Company open-deal count, pipeline value, and weighted probability recalculate after create, edit, stage move, delete, or reassignment.
- Deal detail shows the company, contact, notes, close date, stage history/activity, and value.
- A board interaction may use stage selectors; drag-and-drop is optional for this MVP and is not required for completion.

### Activities

Activities represent calls, emails, meetings, notes, and tasks.

Required behavior:
- Create, edit, and delete activities.
- Link an activity to a company, contact, and/or deal.
- Mark tasks/activities complete and reopen them.
- Show open, completed, and overdue state clearly.
- Sort the working list so overdue/open work is actionable.
- Contextual timelines on company/contact/deal detail views use these same records.

### Forecast

Forecast is read-only and calculated from deals.

Required behavior:
- Show open pipeline value, weighted forecast, won revenue, win rate, and stage breakdown.
- No manually editable forecast records.

## Navigation and UX

- Real routes remain: `/companies`, `/contacts`, `/deals`, `/activities`, `/forecast`.
- No fake trial, billing, team, profile, or reporting controls.
- Every visible primary action either performs a real action or navigates somewhere real.
- Empty states explain the next useful action.
- Forms surface backend validation errors and disable while saving.
- Destructive actions require explicit confirmation.
- Mobile behavior must remain usable with the existing responsive sidebar/sheets.

## Data model and integrity

Keep a single Next.js app with Convex at the repo root.

Tables:
- `companies`
- `contacts`
- `deals`
- `activities`

Relationships use Convex document IDs.

No multi-tenancy, organizations, billing, email-sequence engine, or public landing page in this MVP.

All public Convex CRM functions require authenticated CRM access and use argument/return validators.

## Error handling

- Invalid or missing linked records fail on the backend even if the UI already prevents them.
- Duplicate company names and contact emails return user-facing errors.
- Referential deletes fail with a useful message instead of silently orphaning records.
- Mutations do not leave derived company pipeline metrics stale after deal changes.

## Verification

The completion pass is done only when:
- Convex schema/functions generate successfully.
- TypeScript passes.
- ESLint has zero product-code errors.
- Next.js production build passes.
- Core calculations and validation logic have automated tests.
- The five primary routes render successfully in a production build.
- No dead primary navigation/action is intentionally left in the finished MVP.

## Deployment

The updated Convex schema/functions must be deployed before the matching frontend is promoted to `crm.pama.company`. Frontend deployment must never be promoted first when it references new Convex functions.
