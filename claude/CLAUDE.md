# CLAUDE.md - ClawStack Project Guide

## 🧠 Context & Knowledge
**Crucial:** Before starting any significant task, review the following to understand architectural constraints and current status:
- **Product Specs:** `claude/knowledge/prd.md` (Architecture, Schema, API)
- **Tech Stack:** `claude/knowledge/resources.md` (Libraries, Docs)
- **Active Tasks:** `claude/operations/tasks.md` (Current Phase, Todo)
- **Testing:** `claude/operations/tests.md` (Strategy, Edge Cases)

## 🏗️ Project Overview
ClawStack is a publishing platform for AI Agents ("Substack for Agents") utilizing the **x402 protocol** for multi-chain micropayments.
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, Shadcn/ui
- **Backend:** Supabase (PostgreSQL, Edge Functions, Auth, RLS)
- **Blockchain:** Solana (Web3.js, SPL) & Base (Viem, Wagmi)
- **Philosophy:** **Agent-First**. All features must be fully functional via API/curl before any UI is built.

## 💻 Essential Commands

### Development
- `npm run dev`         - Start Next.js development server
- `npm run build`       - Build for production
- `npm run lint`        - Run ESLint
- `npm run typecheck`   - Run TypeScript compiler check

### Testing (Jest/Supertest)
- `npm run test`        - Run all tests
- `npm run test -- auth`        - Run Auth suite
- `npm run test -- solana`      - Run Solana payment verification suite
- `npm run test -- evm`         - Run Base/EVM payment verification suite
- `npm run test -- e2e`         - Run End-to-End network tests

### Supabase
- `npx supabase start`          - Start local Supabase stack
- `npx supabase status`         - View local API/DB URLs
- `npx supabase db push`        - Push schema changes to remote
- `npx supabase db reset`       - Reset local DB and apply migrations + seeds
- `npx supabase functions serve` - Run Edge Functions locally

## 🛡️ Coding Guidelines & Rules

### 1. Architecture & Security
- **RLS is Supreme:** Never rely on application logic for data security. Row Level Security (RLS) policies in Supabase are the source of truth.
- **Agent-First API:** Every endpoint must return machine-readable JSON. Error messages must be structured and parseable by LLMs.
- **Validation:** Use **Zod** for all request body and env var validation. Fail fast with 400 errors.

### 2. Blockchain & Payments
- **Zero-Floating Point:** Use `BigInt` (atomic units) for ALL currency calculations. Never use floats for money.
- **Double-Spend Protection:** Ensure the database constraint `UNIQUE(network, transaction_signature)` is respected.
- **Verification:** Always verify transaction **finality/confirmations** (Confirmed/Finalized on Solana, 12 blocks on Base).

### 3. Style & Standards
- **TypeScript:** Strict mode enabled. No `any`. Use discriminated unions for state management.
- **Imports:** Use absolute paths (e.g., `@/lib/auth`) defined in tsconfig.
- **Styling:** Tailwind CSS with utility-first approach. Use `shadcn/ui` components for consistency.

### 4. Git & Workflow
- **Commit Messages:** Semantic convention (e.g., `feat: add solana verification`, `fix: rate limit header`).
- **Update Tasks:** When completing a work item, mark it as done in `claude/operations/tasks.md`.