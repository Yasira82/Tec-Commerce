> ⚡ **SESSION START — أول حاجة:** اقرأ `knowledge-base/C-02___CURRENT_STATE_.md` من `yasira82/tec-knowledge-base` (branch: `main`) — ده مصدر الحقيقة للوضع الحالي. لا تعتمد على الذاكرة أو الملخص.

---

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
- body.merchantId to derive merchant identity (FORBIDDEN)
- Direct payment creation from commerce service
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

## Pi App Identity

| App | Pi App ID | Domain |
|-----|-----------|--------|
| Tec-Commerce | `commerce-app-68aa99081fc1897a` | `https://tec-commerce-app.vercel.app` |

---

## Common Debug Patterns

### "Merchant sees another merchant's orders"
```
Symptom: Merchant dashboard shows orders not belonging to them.
Cause:   Merchant identity derived from request body.
Fix:     ALWAYS derive merchant identity from tec_user cookie (server-side only).
```

### "Order stuck in 'pending' after Pi payment completes"
```
Symptom: Pi payment succeeds but order not created.
Cause:   POST /api/bff/orders not called after payment completion.
Fix:     Verify onReadyForServerCompletion callback calls POST /api/bff/orders.
```

---

## Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Merchant ID spoofing via request body | P0 | NEVER trust client-sent merchant IDs |
| R2 | Hub→Commerce payment failure (C-76) | P0 | `isHubNavigation()` → Mode 1 — DO NOT REMOVE |
| R3 | Railway URL in client bundle | P1 | server-only `API_GATEWAY_URL` |

---

## Release Gate Protocol

```bash
npm run type-check    # 0 errors
npm run lint          # 0 errors
npx vitest            # all pass
git status            # clean
```

---

## Knowledge Base Reference

→ `yasira82/tec-knowledge-base` (branch: `main`)
→ **Current State: `knowledge-base/C-02___CURRENT_STATE_.md`** — اقرأه أول كل session
→ Master index: `knowledge-base/C-57___MASTER_CONTENTS_INDEX.md`
→ Domain ownership matrix: `knowledge-base/C-68___DOMAIN_OWNERSHIP_MATRIX.md`
→ Payment ownership (ADR-007): `knowledge-base/C-76___ADR-007.md`

---

## Skills

Available via plugin — invoke automatically when the situation matches:

| Situation | Skill |
|-----------|-------|
| Writing new feature or fixing a bug → use TDD | `/tdd` |
| Bug, regression, or unexpected behavior | `/diagnose` |
| Writing or modifying tests | `/test-guard` |
| Writing or modifying BFF routes, payment handlers, or API contracts | `/clean-code-guard` |
| Updating docs, CLAUDE.md, or knowledge-base entries | `/docs-guard` |
| Planning a new feature or architectural decision | `/grill-with-docs` |
| Breaking down a roadmap item into GitHub Issues | `/to-issues` |
| Session is getting long or context is filling up | `/handoff` |
| Adding pre-commit hooks to this repo | `/setup-pre-commit` |
