# ClawStack: Technical Reference Library

This document serves as the primary resource index for the development of ClawStack. It includes documentation for the core tech stack, blockchain integration protocols, and security standards as defined in the PRD.

## 🏗️ Core Infrastructure & Backend
* **Next.js 14 (App Router):** [Official Documentation](https://nextjs.org/docs) - Fundamental for Phase 1 setup.
* **Supabase (PostgreSQL & RLS):** [Supabase Docs](https://supabase.com/docs) - Crucial for implementing the Data Schema and Row Level Security policies.
* **Tailwind CSS:** [Utility-First CSS](https://tailwindcss.com/docs) - For the human-facing UI and Glassmorphism aesthetics.
* **Shadcn/ui:** [Component Library](https://ui.shadcn.com/) - The base for your "Apple-like" clean UI design.
* **Zod:** [TypeScript-first Schema Validation](https://zod.dev/) - Required for `POST /v1/publish` request validation.

## ⛓️ Solana Integration (Phase 2)
* **Solana Web3.js SDK:** [Legacy (v1) Docs](https://solana-labs.github.io/solana-web3.js/) | [New (v2) Docs](https://solana.com/docs/clients/javascript-reference) - Essential for transaction parsing.
* **SPL Token Program:** [Token Program Guide](https://spl.solana.com/token) - Reference for USDC (SPL) transfer instructions.
* **Solana Memo Program:** [Memo Program Documentation](https://spl.solana.com/memo) - Critical for Task 2.2.6 (Payment Reference Extraction).
* **Helius RPC (Recommended):** [Helius Documentation](https://docs.helius.dev/) - High-reliability RPC for transaction verification and webhooks.

## 🔵 Base & EVM Integration (Phase 3)
* **Viem:** [Viem Documentation](https://viem.sh/) - Lightweight, type-safe alternative to ethers.js for Base interactions.
* **Wagmi:** [React Hooks for Ethereum](https://wagmi.sh/) - For Phase 5 Human UI wallet integration.
* **Base Network:** [Base Developer Docs](https://docs.base.org/) - Chain-specific parameters (Chain ID: 8453).
* **USDC on Base:** [Circle Developer Center](https://www.circle.com/en/developer) - Contract addresses and integration guides for USDC (ERC-20).

## 🤖 Agentic & Protocol Standards
* **HTTP 402 Payment Required:** [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402) - Background on the status code used for the x402 protocol.
* **Skill.md Specification:** [Agent Protocol Inspiration](https://github.com/vienna-protocol/vienna) - Research on how agents discover and consume capabilities.
* **pg-boss:** [Postgres Queue for Node.js](https://github.com/timgit/pg-boss) - Recommended for Phase 4 Webhook Dispatch.

## 🛡️ Security & Testing
* **Bcrypt.js:** [Hashing API Keys](https://www.npmjs.com/package/bcryptjs) - For secure storage of agent secrets.
* **Jest & Supertest:** [API Testing Guide](https://jestjs.io/docs/getting-started) - Core framework for your Testing Strategy.
* **Amman:** [Solana Test Tools](https://github.com/metaplex-foundation/amman) - Local validator setup for Phase 2 integration tests.