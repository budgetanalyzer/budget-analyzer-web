# View Dialog and Notification Consistency Manual Testing

Use this checklist to manually verify the notification changes recorded in
[`view-dialog-notification-consistency-audit.md`](view-dialog-notification-consistency-audit.md).
Run these checks against the user-managed local environment at
`https://app.budgetanalyzer.localhost`. Use disposable saved views and
transactions for destructive scenarios.

## Failure Injection

Load the target page and open the relevant dialog before forcing the failure.
In Chrome DevTools, open the Network panel and select **Offline** from the
throttling menu. Submit the action once, then restore **No throttling** before
retrying. Do not reload the application while it is offline.

For a narrower failure, open **More tools > Network request blocking** and
block the applicable endpoint after the page data has loaded:

| Workflow | Request-blocking pattern |
| --- | --- |
| Rename or delete a view | `*/api/v1/views/<view-id>` |
| Remove saved-view membership | `*/api/v1/views/<view-id>/transactions` |
| Edit or delete a transaction | `*/api/v1/transactions/<transaction-id>` |
| Bulk delete transactions | `*/api/v1/transactions/bulk-delete` |
| Complete a reviewed import | `*/api/v1/transactions/batch` |
| Hide a statement format | `*/api/v1/statement-formats/<format-id>/hide` |
| Session heartbeat | `*/auth/v1/session` |

Disable the blocking rule before retrying. A blocked or offline request checks
the generic service-unavailable path. Use the two-tab scenario below to check a
structured backend application error.

## Common Expectations

For every mutation failure:

- Feedback appears at the initiating dialog, row, form, or control rather than
  in a detached top-right toast.
- The error remains visible until it is dismissed, retried, or its containing
  workflow is closed.
- The dismiss control is always visible. Dismissing the message does not close
  the workflow or discard input, drafts, or selections.
- Retrying clears the old error before the new request and succeeds after the
  failure is removed.
- An obvious successful direct manipulation uses the changed interface as its
  feedback and does not show a redundant success message.
- At a narrow mobile viewport, the message does not overflow, its dismiss
  control remains available, and dialog actions remain usable.
- Error feedback does not move keyboard focus. When testing with assistive
  technology or the browser accessibility tree, `MessageBanner` errors are
  atomic alerts; its success and warning messages are atomic statuses.

## Saved-View Rename and Deletion

### Rename failure and retry

1. Open a saved view and choose **Rename View**.
2. Enter a visibly different name.
3. Force the rename request to fail and submit the form.
4. Verify the dialog remains open, the edited name remains in the field, and a
   persistent error appears inside the dialog.
5. Dismiss the error and verify only the message disappears.
6. Remove the injected failure and submit again.
7. Verify the dialog closes, the new name appears, and no success toast or
   banner is shown.

### Delete failure and retry

1. Open **Delete View** for a disposable saved view.
2. Force the delete request to fail and confirm deletion.
3. Verify the dialog remains open, the confirmation context remains visible,
   and the current route does not change.
4. Dismiss the error and verify the dialog remains open.
5. Remove the injected failure and retry.
6. Verify the view is deleted, navigation completes, and no success toast or
   banner is shown.

## Saved-View Membership Removal

1. In a disposable saved view, select one or two transactions and open
   **Remove from view**.
2. Force the membership update to fail and confirm removal.
3. Verify the dialog remains open and shows a persistent error.
4. Dismiss the error and verify the confirmation remains available.
5. Remove the injected failure and retry.
6. Verify the dialog closes and the rows disappear from the saved view without
   a success message.
7. Return to the main Transactions page and verify the transactions still
   exist; membership removal must not delete them.

If suitable transfer or refund candidates exist, repeat the failure and retry
through **Review possible transfers and refunds**. The reviewed checkbox
selection must remain intact after failure.

## Transaction Editing

### Inline edit failure and retry

1. Begin editing a disposable transaction in the Transactions table.
2. Change both its description and account.
3. Force the update request to fail and save.
4. Verify edit mode remains active, both draft values remain, and the error
   appears directly beneath the affected row.
5. Dismiss the error and verify the drafts and edit mode remain.
6. Remove the injected failure and retry.
7. Verify the row updates, edit mode closes, and no success message appears.

### Detail edit failure and retry

1. Open a disposable transaction's detail page and begin editing.
2. Change both editable values, force the update to fail, and save.
3. Verify edit mode and both drafts remain, with a persistent error beside the
   edit controls.
4. Remove the injected failure and retry.
5. Verify the details update without a success message.

## Transaction Deletion

### Single deletion

1. Open the delete confirmation for a disposable transaction.
2. Force the delete request to fail and confirm.
3. Verify the dialog and transaction summary remain, with a persistent error.
4. Remove the injected failure and retry.
5. Verify the dialog closes and the transaction disappears without a success
   message.

### Bulk deletion

1. Select at least two disposable transactions and open the bulk-delete
   confirmation.
2. Force the bulk-delete request to fail and confirm.
3. Verify the dialog remains open, the selected IDs remain selected, and the
   error appears inside the dialog.
4. Dismiss the error and verify the dialog and selection remain.
5. Remove the injected failure and retry.
6. Verify the dialog closes, the selection clears, the rows disappear, and no
   success message appears.

## Reviewed Import

1. Start an import and continue through the editable transaction-preview
   dialog. Use a disposable input file.
2. Make a recognizable edit to a preview row.
3. Force `POST /api/v1/transactions/batch` to fail and submit the import.
4. Verify the dialog remains open, every preview edit remains, and a persistent
   error appears above the footer.
5. Dismiss the error and verify the preview remains intact.
6. Remove the injected failure and retry.
7. Verify the dialog closes and the Transactions page shows the expected
   import-result banner with created, skipped, or duplicate counts. This
   informative result banner is intentional; a detached toast is not.

## Statement-Format Visibility

This scenario requires access to statement-format management.

1. Choose a disposable or safe-to-hide statement format.
2. Force its hide request to fail and choose **Hide**.
3. Verify a persistent error appears immediately beneath the affected format
   and that its action remains available.
4. Dismiss the error and verify the row remains usable.
5. Remove the injected failure and retry.
6. Verify the format becomes hidden without a success message.
7. Repeat the same checks for the corresponding unhide request using
   `*/api/v1/statement-formats/<format-id>/unhide`.

## Session Heartbeat Warning

1. After the authenticated application has loaded, block
   `*/auth/v1/session`.
2. Continue interacting with the page and wait for the next heartbeat. With the
   default configuration this can take up to two minutes; the hook immediately
   retries the failed heartbeat once.
3. Verify a persistent application-level warning appears instead of a toast.
4. Verify its dismiss control is visible and dismissing it does not disturb the
   current route or page state.
5. Remove the blocking rule. A later successful heartbeat should clear the
   underlying connection condition.

## Structured Stale-Membership Error

Use two browser tabs to exercise a real backend application code rather than a
generic network failure:

1. In tab A, select a disposable transaction on the Transactions page and open
   the create-view dialog. Enter a recognizable view name but do not submit it.
2. In tab B, delete the selected transaction.
3. Return to tab A and submit the create-view form using its stale selection.
4. Verify the dialog remains open, the entered name remains, and the stale
   transaction-snapshot instruction appears instead of generic failure copy.
5. Verify the application refreshes its transaction data without silently
   retrying the create request or discarding the entered name.

