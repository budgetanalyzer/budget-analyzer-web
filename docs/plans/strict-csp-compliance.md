# Strict CSP Compliance for Production-Smoke Frontend

## Context

The orchestration repo's Phase 6 (Edge and Browser Hardening) is blocked on this frontend repo. Session 3 audited the production-smoke bundle and found two categories of CSP violations that prevent Session 4 from enforcing a strict `style-src 'self'` policy (no `'unsafe-inline'`, no `'unsafe-eval'`):

1. React inline `style={...}` props in 4 component files (produce DOM `style=""` attributes)
2. `sonner` v2.0.7 unconditionally calls `document.createElement('style')` on module load

Until these are removed, the production-smoke route cannot serve a strict enforced CSP.

**Upstream reference**: `orchestration/docs/plans/security-hardening-v2-phase-6-session-3-frontend-csp-audit.md`

## Part 1: Replace Inline Style Props with Tailwind Classes

### Problem

`style={{ width: '...px' }}` on `TableHead`/`TableCell` elements produces inline style attributes that violate `style-src 'self'`.

### Approach: Column Width Class Utility

Create a static lookup map from pixel sizes to Tailwind arbitrary-value width classes. This ensures Tailwind's JIT scanner finds the complete class strings at build time.

**New file: `src/utils/columnWidth.ts`**

```ts
// Static map so Tailwind JIT can scan the complete class strings
const WIDTH_CLASSES: Record<number, string> = {
  40: 'w-[40px]',
  50: 'w-[50px]',
  60: 'w-[60px]',
  100: 'w-[100px]',
  120: 'w-[120px]',
  150: 'w-[150px]',
  180: 'w-[180px]',
  400: 'w-[400px]',
};

export function columnWidthClass(size: number): string {
  return WIDTH_CLASSES[size] ?? '';
}
```

### File Changes

**`src/features/transactions/components/TransactionTable.tsx`** (line 574)
- Change: `style={{ width: \`${header.getSize()}px\` }}` -> `className={columnWidthClass(header.getSize())}`

**`src/features/transactions/components/EditableTransactionRow.tsx`** (lines 152-225)
- Change prop type: `columnSizes: number[]` -> `columnWidthClasses: string[]`
- Replace all 8 `style={{ width: \`${columnSizes[N]}px\` }}` with `className={columnWidthClasses[N]}`
- Update parent in TransactionTable.tsx (line 598): pass `columnWidthClasses={table.getAllColumns().map((col) => columnWidthClass(col.getSize()))}`

**`src/features/views/components/ViewTransactionTable.tsx`** (lines 320, 342)
- TableHead: `style={{ width: \`${header.getSize()}px\` }}` -> `className={columnWidthClass(header.getSize())}`
- TableCell: `style={{ width: \`${cell.column.getSize()}px\` }}` -> `className={columnWidthClass(cell.column.getSize())}`

**`src/features/analytics/components/YearSelector.tsx`** (lines 76-78)
- Remove `style={{ scrollSnapType: showArrows ? 'x mandatory' : undefined }}`
- Add to the existing `cn()` call: `showArrows && 'snap-x snap-mandatory'`

## Part 2: Replace sonner with Shadcn/UI Toast

### Problem

`sonner` v2.0.7 `dist/index.mjs` line 404 calls `__insertCSS(...)` unconditionally on import. This injects a `<style>` element via `document.createElement('style')`, violating strict CSP. There is no opt-out mechanism.

### Approach: Shadcn/UI Toast (Radix-based)

Add the standard shadcn toast components built on `@radix-ui/react-toast`. All styling is Tailwind classes - no runtime CSS injection.

### New Dependency

- `@radix-ui/react-toast` (install via npm)

### New Files

**`src/components/ui/Toast.tsx`**
Standard shadcn toast primitives: `ToastProvider`, `ToastViewport`, `Toast`, `ToastTitle`, `ToastDescription`, `ToastClose`, `ToastAction`. Variants: `default`, `success`, `destructive`, `warning` using existing theme color tokens from `tailwind.config.js` / `index.css`.

**`src/components/ui/Toaster.tsx`**
Renders current toasts from `useToast()` hook. Mounts `ToastProvider` + `ToastViewport`. Positioned top-right to match current sonner position.

**`src/hooks/useToast.ts`**
State management for toasts with:
- `useToast()` hook returning `{ toasts, toast, dismiss }`
- Exported `toast` object with `.success(message)`, `.error(message)`, `.warning(message)` methods matching current sonner call signature

### Files Modified

**`src/App.tsx`**
- Remove: `import { Toaster } from 'sonner'`
- Add: `import { Toaster } from '@/components/ui/Toaster'`
- `<Toaster richColors position="top-right" />` -> `<Toaster />`

**6 component files** - change import only:
- `src/features/transactions/components/EditableTransactionRow.tsx`
- `src/features/transactions/components/TransactionTable.tsx`
- `src/features/transactions/components/DeleteTransactionModal.tsx`
- `src/features/transactions/components/TransactionPreviewModal.tsx`
- `src/features/transactions/components/BulkDeleteModal.tsx`
- `src/features/views/components/ManageViewTransactionsModal.tsx`

Each file: `import { toast } from 'sonner'` -> `import { toast } from '@/hooks/useToast'`

All call sites (`toast.success(...)`, `toast.error(...)`, `toast.warning(...)`) remain unchanged since the wrapper matches the API.

### Dependency Removal

- Remove `sonner` from `package.json`

## Part 3: Documentation Updates ✅

- Updated `AGENTS.md` with "Strict CSP Compliance" guardrail section and agent-facing rules
- Updated `README.md` with "CSP Compliance" section explaining the restriction and reasoning
- Added CSP rationale comments to replacement components: `useToast.ts`, `Toast.tsx`, `Toaster.tsx`, `columnWidth.ts`

## Verification

1. **Build**: `npm run build:prod-smoke` succeeds
2. **No inline styles**: `rg -n "style=\{" src` returns no matches in production code
3. **No runtime style injection**:
   ```bash
   rg -n "createElement\('style'\)|createElement\(\"style\"\)|styleSheet\.cssText|appendChild\(document\.createTextNode|eval\(|new Function" dist/
   ```
   No matches expected.
4. **sonner removed**: `ls node_modules/sonner` should fail after `npm install`
5. **Smoke build paths**: Confirm `dist/index.html` references `/_prod-smoke/assets/...` paths
6. **Lint**: `npm run lint:fix` passes
7. **Tests**: `npx vitest run` passes
8. **Orchestration audit**: `cd ../orchestration && ./scripts/dev/audit-phase-6-session-3-frontend-csp.sh` passes

## Files Summary

| Action | File |
|--------|------|
| Create | `src/utils/columnWidth.ts` |
| Create | `src/components/ui/Toast.tsx` |
| Create | `src/components/ui/Toaster.tsx` |
| Create | `src/hooks/useToast.ts` |
| Modify | `src/features/transactions/components/EditableTransactionRow.tsx` |
| Modify | `src/features/transactions/components/TransactionTable.tsx` |
| Modify | `src/features/views/components/ViewTransactionTable.tsx` |
| Modify | `src/features/analytics/components/YearSelector.tsx` |
| Modify | `src/App.tsx` |
| Modify | `src/features/transactions/components/DeleteTransactionModal.tsx` |
| Modify | `src/features/transactions/components/TransactionPreviewModal.tsx` |
| Modify | `src/features/transactions/components/BulkDeleteModal.tsx` |
| Modify | `src/features/views/components/ManageViewTransactionsModal.tsx` |
| Modify | `package.json` (add radix toast, remove sonner) |
| Modify | `AGENTS.md` |

## Residual CSP Risk

After these changes, the only remaining style-related CSP concern would be if any other bundled dependency injects styles at runtime. The orchestration audit script checks for this. No other such dependency was flagged.
