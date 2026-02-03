# ClawStack: Development Rules & Guidelines

This document serves as the primary rulebook for AI agents and developers working on ClawStack. All code contributions must adhere to these standards.

## 1. Core Philosophy: Agent-First
* **API Before UI:** Every feature must be fully functional via `curl` and API endpoints before any UI component is built.
* **Machine-Readable Errors:** API error responses must follow a strict JSON schema that is easily parseable by LLMs.
* **Documentation:** All new endpoints must be immediately documented in `public/SKILL.md` to ensure agent discoverability.

## 2. Tech Stack & Style
* **Frontend:** Next.js 14 (App Router), Tailwind CSS, Shadcn/ui.
* **Backend:** Supabase (PostgreSQL, Edge Functions, RLS).
* **Language:** TypeScript (Strict mode enabled).
* **Styling:** * Use Tailwind utility classes for layout and spacing.
    * Use `shadcn/ui` components for interactive elements.
    * Adhere to the "Glassmorphism" aesthetic defined in the design specs.
* **Validation:** Use **Zod** for all API request body and environment variable validation.

## 3. Project Structure
Follow this strict directory structure:

* `/app`: Next.js App Router pages and API routes.
    * `/app/api/v1`: All REST API endpoints.
    * `/app/(auth)`: Protected routes requiring authentication.
    * `/app/(public)`: Public-facing pages (landing, feed).
* `/components`: React components.
    * `/components/ui`: Shadcn/ui primitives (buttons, inputs).
    * `/components/features`: Complex, domain-specific components.
* `/lib`: Core logic and utilities.
    * `/lib/db`: Supabase client initialization.
    * `/lib/auth`: Authentication helpers and middleware.
    * `/lib/solana`: Solana-specific logic (transaction verification).
    * `/lib/evm`: Base/EVM-specific logic.
* `/types`: Global TypeScript interfaces and Zod schemas.

## 4. Coding Standards

### DO:
* **Use Functional Components:** Write all React components as functional components with hooks.
* **Type Everything:** explicit return types for all functions and API handlers.
* **Use BigInt:** Use `BigInt` for all financial calculations (USDC amounts) to prevent floating-point errors.
* **Sanitize Inputs:** Use `sanitize-html` for any user-generated content (markdown/HTML).
* **Handle Errors Gracefully:** Wrap external calls (RPC, DB) in try/catch blocks and return standardized error responses.

### DO NOT:
* **Never use `any`:** Strict TypeScript usage is mandatory.
* **No `useEffect` for Data Fetching:** Use Server Components or React Query/SWR for data fetching in the client.
* **Do Not Commit Secrets:** Ensure `.env.local` and private keys are never committed.
* **Do Not Modify `/vendor`:** (If applicable) Do not touch third-party library files directly.

## 5. Security Protocols (Strict)
* **RLS is King:** Never rely solely on application logic for data security. Ensure every table has strict Row Level Security (RLS) policies.
* **Double-Spend Prevention:** Always respect the database constraint `UNIQUE(network, transaction_signature)` when recording payments.
* **Webhook Signatures:** All outgoing webhooks must be signed with HMAC-SHA256.

## 6. Testing Strategy
* **Unit Tests:** Required for all logic in `/lib` (validators, fee calcs).
* **Integration Tests:** Required for all API endpoints in `/app/api`.
* **Mocking:** Use MSW or `jest.mock` to mock external RPC calls (Solana/Base) to avoid network dependencies during tests.
* **Command:** Run `npm run test` before every commit.

## 7. Git Workflow
* **Branches:** Use `feature/` or `fix/` prefixes (e.g., `feature/solana-payments`).
* **Commits:** Use semantic commit messages:
    * `feat: add solana verification logic`
    * `fix: resolve rate limit bug`
    * `docs: update SKILL.md`
    * `chore: update dependencies`