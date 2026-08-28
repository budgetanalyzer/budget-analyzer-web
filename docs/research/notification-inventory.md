# Application Notification Inventory

## Pattern Name

The application uses a **contextual feedback hierarchy**:

> Put feedback at the narrowest scope that contains the event, and keep it
> visible in proportion to how actionable or consequential it is.

“Notification locality” is useful shorthand. The hierarchy combines inline
feedback, flash messages, persistent alerts, status messages, error states, and
one blocking warning rather than depending on a detached transient surface.

## Scope and Counts

This snapshot is based on current production source and excludes tests:

- zero global transient toast emissions, providers, or primitives;
- 25 `MessageBanner` render sites;
- 13 `ErrorBanner` render sites;
- nine specialized persistent condition-callout categories; and
- one session-warning modal.

The counts describe source render sites, not the number of runtime messages.
One site may present more than one event type, and one condition may be rendered
at several sites. Retained messages carry information that is not safely
inferred from the changed interface alone.

## 1. Global Transient Toasts

There are none. The root has no toast provider, production source has no toast
emission API, and package metadata has no toast dependency. Background session
connectivity uses a stable application-level banner instead.

The product contract does not reserve a toast exception. New feedback must use
an existing contextual surface or establish a separately reviewed stable
surface without adding a toast system.

## 2. Contextual Dismissible Banners

These 25 render sites use
[`MessageBanner`](../../src/components/MessageBanner.tsx): a lightly tinted,
animated surface placed in the related page or workflow with an always-visible
close button.

| Event or condition | Type and lifetime | Context |
| --- | --- | --- |
| Session heartbeat cannot reach the server after its retry | Warning, persistent until dismissed or a successful local/cross-tab heartbeat | Application-level status before the protected route tree. [`SessionHeartbeatProvider.tsx`](../../src/components/SessionHeartbeatProvider.tsx#L20) |
| Transaction import preview failure or completed-import result | Error persists until dismissed or another attempt; result is removed after five seconds | One page-level site receives preview errors and created/skipped/intentionally imported duplicate counts, including whether filters may hide new rows. [`TransactionsPage.tsx`](../../src/features/transactions/pages/TransactionsPage.tsx#L292) |
| Invalid or disabled amount-filter currency | Warning, removed by clearing the invalid filter | The Transactions and saved-view pages each render the condition; closing resolves it. [`TransactionsPage.tsx`](../../src/features/transactions/pages/TransactionsPage.tsx#L299), [`ViewPage.tsx`](../../src/features/views/pages/ViewPage.tsx#L381) |
| Newly created statement format during import | Success, persistent until dismissed or workflow state changes | Confirms the format was saved and instructs the user to choose a statement file. [`ImportButton.tsx`](../../src/features/transactions/components/ImportButton.tsx#L406) |
| Currency creation or update failure | Error, persistent and contextual | Appears above the corresponding form. [`CurrencyCreatePage.tsx`](../../src/features/admin/currencies/pages/CurrencyCreatePage.tsx#L74), [`CurrencyEditPage.tsx`](../../src/features/admin/currencies/pages/CurrencyEditPage.tsx#L135) |
| Currency created or updated after navigation | Success flash banner, removed after five seconds | Router state carries the result to the destination list, which consumes and clears it. [`CurrenciesListPage.tsx`](../../src/features/admin/currencies/pages/CurrenciesListPage.tsx#L122) |
| Statement-format creation or update failure | Error, persistent and contextual | Appears above the corresponding form. [`StatementFormatCreatePage.tsx`](../../src/features/admin/statement-formats/pages/StatementFormatCreatePage.tsx#L76), [`StatementFormatEditPage.tsx`](../../src/features/admin/statement-formats/pages/StatementFormatEditPage.tsx#L146) |
| Statement format created or updated after navigation | Success flash banner, removed after five seconds | Uses the same router-state destination pattern as currencies. [`StatementFormatsListPage.tsx`](../../src/features/admin/statement-formats/pages/StatementFormatsListPage.tsx#L121) |
| User deactivation fails | Error, persistent until dismissed or retried | The dialog closes and the error remains on the user detail page. [`UserDetailPage.tsx`](../../src/features/admin/users/pages/UserDetailPage.tsx#L131) |
| CSV or PDF wizard step fails | Error, persistent and contextual | Appears inside the active wizard; field-specific failures stay beside their fields. [`CsvStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/csv-wizard/CsvStatementFormatWizardDialog.tsx#L435), [`PdfStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog.tsx#L1066) |
| Saving a view fails or encounters a stale snapshot | Error, persistent until dismissed, retried, or closed | Keeps the entered name and, for stale membership, provides review instructions. [`CreateViewModal.tsx`](../../src/components/CreateViewModal.tsx#L151) |
| Manual or transfer/refund-assisted membership removal fails | Error, persistent until dismissed, retried, or closed | Keeps the dialog and reviewed transaction selection available. [`RemoveViewTransactionsModal.tsx`](../../src/features/views/components/RemoveViewTransactionsModal.tsx#L90), [`TransferRefundReviewDialog.tsx`](../../src/features/views/components/TransferRefundReviewDialog.tsx#L157) |
| Saved-view rename or deletion fails | Error, persistent until dismissed, retried, or closed | Preserves the edited name or confirmation context and keeps the user on the view. [`EditViewModal.tsx`](../../src/features/views/components/EditViewModal.tsx#L94), [`DeleteViewModal.tsx`](../../src/features/views/components/DeleteViewModal.tsx#L78) |
| Inline transaction edit fails | Error, persistent until dismissed, cancelled, or retried | A full-width row directly below the transaction preserves edit mode and both drafts. [`EditableTransactionRow.tsx`](../../src/features/transactions/components/EditableTransactionRow.tsx#L331) |
| Detail-page transaction edit fails | Error, persistent until dismissed, cancelled, or retried | Remains beside the edit controls while both drafts and edit mode stay available. [`TransactionDetailPage.tsx`](../../src/features/transactions/pages/TransactionDetailPage.tsx#L211) |
| Single transaction deletion fails | Error, persistent until dismissed, retried, or the dialog closes | Keeps the confirmation and transaction summary available. [`DeleteTransactionModal.tsx`](../../src/features/transactions/components/DeleteTransactionModal.tsx#L126) |
| Bulk-deletion request fails | Error, persistent until dismissed, retried, or the dialog closes | Keeps the confirmation and selected IDs available. [`BulkDeleteModal.tsx`](../../src/features/transactions/components/BulkDeleteModal.tsx#L84) |
| Reviewed batch import fails | Error, persistent until dismissed, retried, or the dialog closes | Remains above the review footer and preserves every edited preview row. [`TransactionPreviewModal.tsx`](../../src/features/transactions/components/TransactionPreviewModal.tsx#L337) |
| Statement-format hide or restore fails | Error, persistent until dismissed or another attempt | A full-width row appears immediately below the affected format. [`StatementFormatVisibilityTable.tsx`](../../src/features/statement-formats/components/StatementFormatVisibilityTable.tsx#L145) |

The router-carried cases are **flash messages**. They are retained because the
mutation completed on a route that is no longer mounted.

## 3. Deliberately Silent Outcomes

The changed interface is the feedback for successful direct manipulations:

- inline and detail transaction edits;
- single transaction deletion;
- saved-view creation, rename, deletion, and both membership-removal flows;
- statement-format hide and restore; and
- user deactivation.

Bulk deletion also stays silent for full, partial, and zero-deletion successful
responses. IDs reported as not found are already absent, so every successful
response converges on the refreshed table, closes the dialog, and clears the
selection; retry instructions or detached counts would be misleading.

Changing display currency clears incompatible amount bounds and their currency
marker from the URL without a message. The selected currency, cleared controls,
and URL are the visible outcome.

Reviewed import is intentionally different: its page-level result remains
because created, skipped, and deliberately imported duplicate counts—and the
possibility that current filters hide new rows—cannot be inferred from the
refreshed table.

## 4. Persistent Condition Callouts

These are not mutation-result messages. They describe a condition that remains
true, so the message remains until the condition resolves.

| Condition | Type | Use |
| --- | --- | --- |
| Disabled currencies or exchange rates still being imported | Warning callout | Reused on Transactions, saved-view detail, and Analytics. Pending rates provide Refresh; disabled currencies do not. [`MissingExchangeRatesBanner.tsx`](../../src/components/MissingExchangeRatesBanner.tsx#L19) |
| Transactions excluded because conversion is unavailable | Status callout | Appears above ordinary and saved-view transaction tables until no rows are excluded. [`TransactionTable.tsx`](../../src/features/transactions/components/TransactionTable.tsx#L439), [`ViewTransactionTable.tsx`](../../src/features/views/components/ViewTransactionTable.tsx#L344) |
| Saved-view memberships absent from the current snapshot | Status callout | Persistent diagnostic on the saved-view page. [`ViewPage.tsx`](../../src/features/views/pages/ViewPage.tsx#L389) |
| Add-to-view mutation fails or membership becomes stale | Inline error alert | Appears beside selection controls until selection changes or another attempt occurs. [`TransactionTable.tsx`](../../src/features/transactions/components/TransactionTable.tsx#L624) |
| Uploaded file was already imported | Warning alert | Persistent inside the preview dialog with prior-import details. [`PreviewFileImportWarningBanner.tsx`](../../src/features/transactions/components/PreviewFileImportWarningBanner.tsx#L33) |
| CSV analysis or preview produces warnings | Warning callout | Server-provided warnings at the relevant wizard step. [`CsvStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/csv-wizard/CsvStatementFormatWizardDialog.tsx#L125) |
| PDF cannot be used to create a format | Blocking inline error state | Displays all unsupported reasons and changes the available next steps. [`PdfStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog.tsx#L1093) |
| PDF transaction-table candidate has low confidence | Warning callout | Requests review before continuing. [`PdfStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog.tsx#L1129) |
| PDF preview contains user-facing diagnostics | Warning callout | Shows diagnostics immediately above the preview table. [`PdfStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog.tsx#L1497) |

## 5. Blocking Notification

There is one interruptive notification:

- **“Session Expiring”** is a modal warning with a live countdown and required
  Continue action. It cannot be dismissed through ordinary dialog controls;
  expiry logs the user out. The modal is justified because the event is
  time-sensitive, consequential, and requires action.
  [`InactivityWarningModal.tsx`](../../src/components/InactivityWarningModal.tsx#L26)

## 6. Persistent Load and Workflow Error States

`ErrorBanner` is an error state rather than a transient notification. It
displays the server message and error code, optionally with Retry, and remains
until the query succeeds or the user leaves.

Its 13 render sites cover:

- Transactions and add-to-view target loading:
  [`TransactionsPage.tsx`](../../src/features/transactions/pages/TransactionsPage.tsx#L259),
  [`TransactionsPage.tsx`](../../src/features/transactions/pages/TransactionsPage.tsx#L83)
- Transaction detail:
  [`TransactionDetailPage.tsx`](../../src/features/transactions/pages/TransactionDetailPage.tsx#L154)
- Saved-view list and detail:
  [`ViewsPage.tsx`](../../src/features/views/pages/ViewsPage.tsx#L26),
  [`ViewPage.tsx`](../../src/features/views/pages/ViewPage.tsx#L301)
- Transfer/refund discovery inside its dialog:
  [`TransferRefundReviewDialog.tsx`](../../src/features/views/components/TransferRefundReviewDialog.tsx#L137)
- Analytics source:
  [`AnalyticsPage.tsx`](../../src/features/analytics/pages/AnalyticsPage.tsx#L175)
- Statement-format management:
  [`StatementFormatManagementPage.tsx`](../../src/features/statement-formats/pages/StatementFormatManagementPage.tsx#L114)
- Admin transaction and user searches:
  [`AdminTransactionsPage.tsx`](../../src/features/admin/transactions/pages/AdminTransactionsPage.tsx#L85),
  [`UsersListPage.tsx`](../../src/features/admin/users/pages/UsersListPage.tsx#L78)
- Admin user detail:
  [`UserDetailPage.tsx`](../../src/features/admin/users/pages/UserDetailPage.tsx#L88)
- CSV and PDF wizard non-field errors:
  [`CsvStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/csv-wizard/CsvStatementFormatWizardDialog.tsx#L438),
  [`PdfStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog.tsx#L1069)

Older bespoke error states cover admin currency/statement-format loads,
authentication failure, unauthorized access, router failure, and uncaught
React errors. These replace page content rather than notifying over it.

## What Is Not a Notification

The following surfaces are classified separately:

- Confirmation dialogs request permission before an action; they do not report
  an outcome.
- Field validation belongs beside the field.
- Loading indicators communicate progress.
- Empty states describe content absence.
- Duplicate markers and unavailable-conversion labels inside rows or cards are
  data annotations.
- Selection banners such as “All 10 transactions on this page are selected”
  are contextual controls or prompts.

There is no browser Notification API, push notification, notification center,
inbox, persisted notification history, or global notification event bus.

## What This Says About Issue #2

Current production behavior follows this rule:

- Load failure → persistent error state.
- Actionable form or mutation failure → persistent contextual alert that
  preserves user work.
- Cross-route or otherwise non-obvious result → explicit contextual or flash
  banner.
- Continuing or background/global condition → persistent contextual or
  application-level status.
- Required, time-sensitive action → modal.
- Obvious direct manipulation or converged idempotent result → changed
  interface without a detached notification.

`MessageBanner` exposes errors as atomic `role="alert"` messages and its
success and warning variants as atomic `role="status"` messages. That
accessible-status statement applies only to the explicit feedback rendered
through `MessageBanner`. It does not claim that `ErrorBanner`,
`MissingExchangeRatesBanner`, bespoke query/load callouts, or every other
status-like surface was migrated to the same semantic contract.
