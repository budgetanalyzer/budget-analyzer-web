 For the remaining mutation-error migration, I would not mechanically replace every toast.error with the same banner. Use the narrowest stable surface for each workflow.

   Surface                          Recommended presentation                             Failure behavior
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Create saved view                MessageBanner inside the form, above the footer      Keep dialog and name; clear on retry, dismiss, or close
   ** user- do we need to show anything here?  we close the form and switch to the view do we not?  

  ───────────────────────────────  ───────────────────────────────────────────────────  ─────────────────────────────────────────────────────────
   Delete transaction               MessageBanner inside the confirmation dialog         Keep dialog and transaction context; retry in place

    ** user- do we need to show anything here?  we close the form and the transaction is gone?

  ───────────────────────────────  ───────────────────────────────────────────────────  ─────────────────────────────────────────────────────────
   Reviewed import                  MessageBanner immediately above the fixed footer     Keep the edited preview and dialog open

    ** user- do we need to show anything here?  we show a message banner after successful import don't we?  on the main tranactions page?

  ───────────────────────────────  ───────────────────────────────────────────────────  ─────────────────────────────────────────────────────────
   Transaction detail edit          Banner below the edit controls, above the cards      Keep edit mode and both draft fields
    ** user- do we need to show anything here? 

  ───────────────────────────────  ───────────────────────────────────────────────────  ─────────────────────────────────────────────────────────
   Inline table edit                Alert row directly beneath the edited transaction    Keep that row in edit mode with its draft values
    ** user- do we need to show anything here?  the user can see the fields are changed?

  ───────────────────────────────  ───────────────────────────────────────────────────  ─────────────────────────────────────────────────────────
   Bulk delete request failure      Banner inside the confirmation dialog                Keep selection and permit retry
    ** user- shouldn't this be a standard error banner?  banner inside a dialog is awkward.

  ───────────────────────────────  ───────────────────────────────────────────────────  ─────────────────────────────────────────────────────────
   Statement-format hide/restore    Alert row beneath the affected format                Keep the row action available for retry
    ** user- do we need to show anything here? 

  Important implementation details:

  - Reuse the completed saved-view pattern: local string | null error state, formatApiError, clear immediately before retry, and render MessageBanner.
  - Do not create global notification state or copy errors into Redux/TanStack Query.
  - Remove the toast only after the contextual failure and its behavioral tests exist.

  The trickier cases deserve special handling:

  1. Inline transaction editing

  Currently src/features/transactions/components/EditableTransactionRow.tsx:53 exits edit mode immediately after calling onSave, before the mutation succeeds. That loses the user’s draft on failure.

  Change the callback contract so the row closes only from an onSuccess callback. On failure:

  - retain both edited fields;
  - retain edit mode;
  - render an adjacent full-width alert row;
  - clear the alert before retry or when editing is cancelled.

  This is more important than merely moving the toast.

  2. Bulk deletion

  Separate transport failure from a successful request with unusual results:

  - Request failure: keep the modal open and show a persistent error there.
  - Full success: close, clear selection, and rely on removed rows.
  - Partial success: close and show a contextual warning above the table with deleted/missing counts.
  - Zero deleted because every ID was already absent: treat this as a result warning, not “Failed to delete transactions.” Close and clear the stale selection because retrying the same IDs cannot help.

  That likely requires BulkDeleteModal to return the result to TransactionTable, which should own the post-close partial/zero-result banner.

  3. Statement formats

  Store { formatId, message } on the management page and pass it into the table. Render the error immediately beneath the affected format row. Include the format name in fallback copy, for example:

  > Could not hide “Chase CSV”. Try again.

  Only one row currently has a pending action, so a single row-scoped error is sufficient.

  4. Saved-view stale snapshot

  3. Table actions: bulk deletion and statement-format visibility. ** user- do we need to show anything here?  we close the form and switch to the view do we not?  