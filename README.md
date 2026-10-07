# Pama CRM

Internal sales CRM for Pama, built on the Kargul Studio sales CRM interface.

## Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- Convex
- Clerk
- Zustand for transient UI state

## Development

Install dependencies:

```bash
npm install
```

Link or start a Convex development deployment:

```bash
npx convex dev
```

Then start Next.js:

```bash
npm run dev
```

## Environment

The Next.js app needs:

```bash
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

Configure the Clerk issuer on the Convex deployment:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://your-clerk-domain.clerk.accounts.dev"
```

The Clerk application must also have its Convex integration enabled so Convex can validate Clerk-issued tokens.

Any signed-in account can access the CRM. Authentication is required; there is no email allowlist.

## Current backend scope

Companies are now read from and created in Convex. Filters, selections, dialogs, and other transient interface state stay in Zustand.

Deals, contacts, activities, owners, notifications, and reporting are still demo/frontend data and can be migrated incrementally.

## License

This repository is derived from Kargul Studio's MIT-licensed sales CRM. The upstream copyright and license notice are retained in [LICENSE](./LICENSE).
