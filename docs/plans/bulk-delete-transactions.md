# Bulk Delete Transactions Feature

## Overview

Add bulk delete functionality to the transactions view with checkbox selection pattern and modern floating action bar design.

## Current State

- TanStack Table configured without row selection
- No Checkbox UI component (needs to be added from Shadcn)
- Only single delete API exists (`DELETE /v1/transactions/:id`)
- `EditableTransactionRow` handles individual row rendering
- `DeleteTransactionModal` handles single transaction deletion

## Implementation Plan

### 1. Add Checkbox UI Component

**File:** `src/components/ui/Checkbox.tsx`

- Add Shadcn Checkbox component using Radix UI primitives
- Tailwind styling consistent with existing UI components
- Support for indeterminate state (for "select all" when partial selection)

### 2. Create Bulk Delete Hook

**File:** `src/hooks/useBulkDeleteTransactions.ts`

- New React Query mutation accepting `number[]` of transaction IDs
- Calls individual delete endpoints in parallel using `Promise.allSettled`
- Returns success/failure counts for user feedback
- Optimistically updates cache by removing deleted items
- Handles partial failures gracefully

```typescript
interface BulkDeleteResult {
  successCount: number;
  failedCount: number;
  failedIds: number[];
}
```

### 3. Enable TanStack Table Row Selection

**File:** `src/features/transactions/components/TransactionTable.tsx`

- Add `rowSelection` state (local useState, not Redux - ephemeral UI state)
- Configure table with:
  - `enableRowSelection: true`
  - `onRowSelectionChange` handler
  - `getRowId` using transaction ID
- Add selection column as first column with:
  - Header checkbox (select all visible on current page)
  - Indeterminate state when partial selection
- Pass selection props to row components

### 4. Add Checkbox to Row Component

**File:** `src/features/transactions/components/EditableTransactionRow.tsx`

- Add checkbox as first TableCell
- New props: `isSelected: boolean`, `onSelectionChange: (checked: boolean) => void`
- Prevent row click navigation when clicking checkbox area
- Visual feedback for selected row (subtle background highlight)

### 5. Create Floating Action Bar

**File:** `src/features/transactions/components/BulkDeleteBar.tsx`

Modern floating bar that appears when items are selected:

- Fixed position at bottom of viewport
- Slides up with animation from `src/lib/animations.ts`
- Content:
  - Left: "{n} transaction(s) selected"
  - Right: "Delete" button (destructive variant)
- Semi-transparent backdrop blur for modern look
- Auto-hides when selection cleared

### 6. Create Bulk Delete Confirmation Modal

**File:** `src/features/transactions/components/BulkDeleteModal.tsx`

Simpler than single delete modal:

- Title: "Delete Transactions"
- Description: "Are you sure you want to delete {n} transaction(s)? This action cannot be undone."
- No detailed transaction info (too many items)
- Footer: Cancel + Delete buttons
- Loading state during deletion with progress indication
- Disable close during deletion

### 7. Integration & Edge Cases

**TransactionTable.tsx updates:**

- Import and render `BulkDeleteBar` and `BulkDeleteModal`
- Track `selectedIds` derived from `rowSelection` state
- Clear selection after successful delete
- Clear selection on page change (optional - discuss with user)

**Toast notifications:**

- Success: "Successfully deleted {n} transaction(s)"
- Partial failure: "Deleted {success} of {total}. {failed} failed."
- Full failure: "Failed to delete transactions"

**Edge cases to handle:**

- Selection cleared when navigating away
- Disabled state during deletion in progress
- Empty state when all selected items deleted

## File Changes Summary

| File | Action |
|------|--------|
| `src/components/ui/Checkbox.tsx` | Create |
| `src/hooks/useBulkDeleteTransactions.ts` | Create |
| `src/features/transactions/components/BulkDeleteBar.tsx` | Create |
| `src/features/transactions/components/BulkDeleteModal.tsx` | Create |
| `src/features/transactions/components/TransactionTable.tsx` | Modify |
| `src/features/transactions/components/EditableTransactionRow.tsx` | Modify |
| `src/lib/animations.ts` | Modify (add slideUp animation) |

## Design Notes

### Why Floating Action Bar?

- Modern pattern (used by Google, Notion, etc.)
- Doesn't clutter the existing toolbar
- Clear visual connection between selection and action
- Easy to dismiss by clearing selection

### Why Local State for Selection?

- Selection is ephemeral (lost on refresh is acceptable)
- No need to persist across page navigation
- Keeps Redux focused on meaningful app state
- Simpler implementation

### API Consideration

Currently no bulk delete endpoint exists. This implementation calls individual deletes in parallel. If performance becomes an issue with large selections, a backend bulk delete endpoint could be added later (out of scope for this frontend-only repo).
