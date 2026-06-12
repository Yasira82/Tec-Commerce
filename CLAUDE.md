# TEC Commerce — Claude Code Instructions

## What This App Is

Merchant-facing commerce management app within the TEC Federated Platform.
Merchant dashboard, product management, order fulfillment, and revenue analytics.

**Current Phase: Phase 0 — Pre-Mainnet Hardening**
No new features until P1 violations closed across platform.

---

## Stack

- Next.js 15 App Router + TypeScript strict
- @yasser172/tec-ui (design system, TEC_COLORS)
- @yasser172/tec-auth (getStoredUser, getAccessToken, ssoRedirect)
- Vitest (unit) + Playwright (e2e)
- Deployment: Vercel

---

## Architecture Rules

### ADR-007 — Pi Foreign Session (CRITICAL)
Every Pi payment handler must include this guard:
```typescript
const isHubNavigation = () =>
  document.referrer.toLowerCase().includes('hub.tecosystem.app')

if (isHubNavigation() || !(window as any).Pi || !piReady) {
  redirectToHubPayment(...)
  return
}
```

### Two-SDK Boundary
```
Client Components  →  lib-client/*  (browser state, auth helpers)
API Routes (BFF)   →  @yasser172/tec-sdk via /api/bff/* (server-side only)
```

### Auth Pattern
- SSO via Hub cookies: `tec_access_token`, `tec_csrf`, `tec_user`
- NEVER localStorage for tokens
- CSRF header on all POST/PUT/DELETE BFF routes

### Merchant Authorization
All merchant actions require verifying merchant role from the `tec_user` cookie.
Never trust client-sent merchant IDs — always derive from the authenticated session.

---

## Kernel Spec (C-47) — Relevant Rules

### Fail Closed (P6)
- Missing or invalid merchant session → deny, redirect to Hub login
- Hub navigation → Force Mode 1 (never attempt Mode 2)
- Client-sent merchantId without session verification → REJECT

### Canonical Entities in Commerce
- **Order** owned by: `tec-commerce-service` — only service may transition order state
- **Subscription** owned by: `tec-commerce-service`
- **Payment** owned by: `tec-payment-service` — commerce NEVER creates payments directly

### Invariants for Commerce
```
1. Order not created until payment approved
2. Every order has an audit trail (actor context required)
3. Order state machine: terminal states are final
4. Revenue figures: DECIMAL(20,8) in DB, string in API
5. Merchant identity ALWAYS from tec_user cookie (never from request body)
```

### Forbidden in Commerce
```
- body.merchantId to derive merchant identity (FORBIDDEN — Policy CI blocks body.userId)
- Direct payment creation from commerce service (go through payment-service)
- Transitioning order from terminal state
```

---

## Development Commands

```bash
npm run dev         # Next.js dev server
npm run build       # Production build
npm run lint        # ESLint
npx vitest          # Unit tests
npx playwright test # E2E tests
```

---

## What NOT To Do

- Do NOT skip ADR-007 `isHubNavigation()` check before any Pi payment
- Do NOT trust client-sent merchant IDs — verify from session cookie
- Do NOT store auth tokens in localStorage
- Do NOT add `NEXT_PUBLIC_*` env vars for internal service URLs
- Do NOT add new features during Phase 0
- Do NOT create payments from commerce service — use tec-payment-service

---

## Commit Convention

```
feat(commerce):  new merchant feature
fix(commerce):   bug fix
fix(payment):    payment flow fix
style(commerce): UI polish
```

---

## Phase 0 Items (C-41 — Before Mainnet)

```
□ Write Vitest tests — target ≥ 60%    ← NEXT priority
□ Document Pi App ID + domain (tec-commerce → tecosystem.app/commerce)
□ Upgrade to @yasser172/tec-ui PaymentModal when v1.2.0 publishes
□ PI_SANDBOX=false verified in production
□ Analytics connection to tec-analytics-service
```

### Test Coverage Targets (Phase 0 gate — target ≥ 60%)
| File | Priority | Scenarios |
|------|----------|-----------|
| Merchant auth guard | HIGH | missing cookie, valid merchant, wrong role |
| Payment handler (ADR-007) | HIGH | isHubNavigation true/false, piReady false, success |
| Order creation flow | HIGH | success, payment_id mismatch, duplicate order |
| BFF routes (products, orders) | MEDIUM | auth fail, gateway error, pagination |

---

## Platform Orchestra — This Repo

**Role:** Transaction Layer — merchant dashboard, order management, revenue analytics
**Upstream:** @yasser172/tec-auth · @yasser172/tec-ui · @yasser172/tec-sdk · tec-commerce-service (4003)
**Layer:** Phase 0 hardening

---

## Commercial Targets

- Merchant onboarding: dashboard live before Phase 2 (Pi Portal submission)
- Order fulfillment: full cycle through tec-commerce-service
- Revenue analytics: merchant sees Pi earnings by product and period
- Tests coverage ≥ 60% before Phase 1

---

## Common Debug Patterns

### "Merchant sees another merchant's orders"
```
Symptom: Merchant dashboard shows orders not belonging to them.
Cause:   Merchant identity derived from request body (merchantId from client).
         Policy CI blocks body.userId/merchantId — this is a P0 security issue.
Fix:     ALWAYS derive merchant identity from tec_user cookie (server-side only).
         Never trust client-sent merchantId — verify from authenticated session.
```

### "Order stuck in 'pending' after Pi payment completes"
```
Symptom: Pi payment succeeds (user gets confirmation) but order not created.
Cause:   POST /api/bff/orders not called after payment completion.
         Or: payment_id not passed correctly in the order payload.
Fix:     Verify onReadyForServerCompletion callback calls POST /api/bff/orders.
         Payload must include: { items: [{productId, qty}], payment_id }.
         Check tec-commerce-service logs for order creation errors.
```

### "Revenue figures show incorrect decimals"
```
Symptom: Revenue shows as integer or truncated (e.g., 1 instead of 1.00000000).
Cause:   Pi amounts converted to JS Number (floating point precision loss).
Fix:     Pi amounts are DECIMAL(20,8) in DB and string in API responses.
         Keep as string until final display: parseFloat(amount).toFixed(2) + ' π'.
         Never store Pi amounts as JS Number internally.
```

### "Payment modal opens but Pi Wallet doesn't appear"
```
Symptom: Payment UI shows but Pi Browser dialog never opens.
Cause:   isHubNavigation() not checked — Pi SDK in foreign session.
Fix:     if (isHubNavigation() || !piReady) → redirect to Hub payment modal.
         This guard MUST exist in every payment handler — DO NOT REMOVE.
```

---

## Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Merchant ID spoofing via request body | P0 | NEVER trust client-sent merchant IDs — session only |
| R2 | Hub→Commerce payment failure (C-76) | P0 | `isHubNavigation()` → Mode 1 — DO NOT REMOVE |
| R3 | INTERNAL_SECRET missing (NEW-B) | BLOCKING | Ops fix — blocks production commerce |
| R4 | Railway URL in client bundle | P1 | server-only `API_GATEWAY_URL` |

---

## Platform Governance

### SHARED
- Merchant identity: derive from `tec_user` cookie — never from request body
- Order state machine: tec-commerce-service owns all order transitions
- Payment: Mode 1/2 via ADR-007 pattern
- Revenue figures: DECIMAL(20,8) in DB, string in API responses

### SOVEREIGN
- Merchant dashboard UI and layout
- Analytics views and reporting design
- Product management workflow
- Order fulfillment tracking UI

---

## Release Gate Protocol

```bash
npm run type-check    # 0 errors
npm run lint          # 0 errors
npx vitest            # all pass
git status            # clean
git fetch origin claude/ecommerce-engineering-review-EuiQO
git rebase origin/claude/ecommerce-engineering-review-EuiQO
```

Merchant security check: verify no `body.merchantId` or `body.userId` used to derive identity.

---

## Platform Context

Full platform context, ADR system, and engineering roadmap:
→ `TEC_MODELS_PAT.prompt.yml` in yasira82/tec-app (branch: claude/ecommerce-engineering-review-EuiQO)
→ `TEC_Ecosystem_AI_Key.prompt.yml` in yasira82/tec-app
→ C-47 Kernel Spec — P6 Fail Closed, Order invariants, Merchant authorization
→ C-41 Engineering Roadmap — Phase 0 commerce items

---

## Dynamic Orchestration

### Ecosystem Role
**Reference Implementation** — first to implement any new platform pattern. If a payment, BFF, or auth pattern works here, it is then propagated to tec-assets and tec-ecommerce.

### Dependency Map

| Direction | Repos / Services |
|-----------|----------------|
| Upstream | `@yasser172/tec-auth` · `@yasser172/tec-ui` · `@yasser172/tec-sdk` · `tec-core-backend` (tec-commerce-service:4003) |
| Downstream | `tec-ecommerce` follows commerce patterns — validate here first |

### Cross-Repo Workflow Triggers

| Event | Coordinate With | Required Action |
|-------|----------------|----------------|
| New payment pattern | tec-ecommerce, tec-assets | Validate here FIRST → document in C-60 → then propagate |
| New BFF route pattern | tec-app (Hub) | Commerce = reference impl — Hub adopts proven patterns |
| Merchant auth pattern change | tec-core-backend | Verify no `body.merchantId` — Policy CI must pass |
| `@yasser172/tec-ui` version bump | tec-app, tec-assets, tec-ecommerce | Coordinate simultaneous deploy with all 4 apps |
| tec-commerce-service API change | tec-sdk | SDK contract must be updated before frontend routes |

### Release Chain Position

```
tec-core-backend (deploy)
  → tec-sdk (npm publish)
    → tec-auth (npm publish)
      → tec-ui (npm publish)
        → tec-app + tec-ecommerce + tec-assets + tec-commerce  ← HERE (simultaneous)
```

### Orchestration Rules
- Commerce = reference implementation (C-47) — test new patterns here before any other app
- Merchant identity ALWAYS from `tec_user` cookie (server-side) — never from request body
- Order state machine owned by `tec-commerce-service` — never duplicate state logic in BFF

### Knowledge Base Reference
→ `yasira82/tec-knowledge-base` (branch: `claude/gifted-knuth-1yhom3`)
→ Master index: `knowledge-base/C-57___MASTER_CONTENTS_INDEX.md`
→ Domain ownership matrix: `knowledge-base/C-68___DOMAIN_OWNERSHIP_MATRIX.md`
→ API contracts governance: `knowledge-base/C-69___API_CONTRACTS_GOVERNANCE.md`
→ Payment ownership (ADR-007): `knowledge-base/C-76___ADR-007.md`
