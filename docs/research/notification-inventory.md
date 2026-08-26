# Application Notification Inventory

## Pattern Name

I’d name the pattern a **contextual feedback hierarchy**:

> Put feedback at the narrowest scope that contains the event, and keep it
> visible in proportion to how actionable or consequential it is.

“Notification locality” is another useful shorthand. It combines established
patterns—inline feedback, flash messages, toasts, alerts, and error states—rather
than being one formally standardized pattern.

## Scope and Counts

I searched production source, excluding tests. I found:

- 13 toast-emission branches;
- 17 `MessageBanner` render sites;
- 13 `ErrorBanner` render sites;
- several specialized inline callouts; and
- one session-warning modal.

The first success-feedback pass removed eight toast branches and one
`MessageBanner` site whose successful outcome was already obvious in the
changed interface. A later saved-view contextual-error pass moved two more
toast branches and added four `MessageBanner` render sites. The counts and
tables below describe current production source; retained messages carry
information that is not safely inferred from the interface alone.

## 1. Global Transient Toasts

All of these appear in the top-right, disappear after five seconds regardless
of severity, and have a close button visible only on hover or focus.

| Event | Type | How it is used |
| --- | --- | --- |
| Session heartbeat cannot reach the server | Warning | Background/global condition; warns that the session may expire. This is the clearest legitimate toast use. [`useSessionHeartbeat.ts`](../../src/hooks/useSessionHeartbeat.ts#L86) |
| Currency change clears amount filters | Information | Reports a secondary consequence of the user’s currency selection. [`CurrencySelector.tsx`](../../src/components/CurrencySelector.tsx#L54) |
| Inline transaction edit fails | Error | Transient mutation error while the table remains mounted. [`TransactionTable.tsx`](../../src/features/transactions/components/TransactionTable.tsx#L144) |
| Detail-page transaction edit fails | Error | Transient mutation error beside no stable recovery surface. [`TransactionDetailPage.tsx`](../../src/features/transactions/pages/TransactionDetailPage.tsx#L110) |
| Single transaction deletion fails | Error | The dialog stays available, but the explanation disappears after five seconds. [`DeleteTransactionModal.tsx`](../../src/features/transactions/components/DeleteTransactionModal.tsx#L50) |
| Bulk deletion partially succeeds | Warning | Communicates deleted versus missing counts that cannot be inferred reliably from the table. [`BulkDeleteModal.tsx`](../../src/features/transactions/components/BulkDeleteModal.tsx#L38) |
| Bulk deletion returns zero deletions | Error | Result-level failure, after which the modal closes and selection is cleared. [`BulkDeleteModal.tsx`](../../src/features/transactions/components/BulkDeleteModal.tsx#L43) |
| Bulk deletion request fails | Error | Request-level failure; modal remains open. [`BulkDeleteModal.tsx`](../../src/features/transactions/components/BulkDeleteModal.tsx#L52) |
| Reviewed batch import fails | Error | The preview dialog stays open, but the failure is presented globally. [`TransactionPreviewModal.tsx`](../../src/features/transactions/components/TransactionPreviewModal.tsx#L265) |
| Saving a view encounters a stale snapshot | Error | Reports that the snapshot was refreshed and the user must review again. [`CreateViewModal.tsx`](../../src/components/CreateViewModal.tsx#L72) |
| Saving a view otherwise fails | Error | Transient failure while the create dialog remains mounted with its input. [`CreateViewModal.tsx`](../../src/components/CreateViewModal.tsx#L78) |
| Hiding a statement format fails | Error | Transient error for a row-level action. [`StatementFormatManagementPage.tsx`](../../src/features/statement-formats/pages/StatementFormatManagementPage.tsx#L52) |
| Restoring a statement format fails | Error | Transient error for a row-level action. [`StatementFormatManagementPage.tsx`](../../src/features/statement-formats/pages/StatementFormatManagementPage.tsx#L67) |

## 2. Contextual Dismissible Banners

These use `MessageBanner`: lightly tinted, animated, placed in the related page
or workflow, and equipped with an always-visible close button.

| Event or condition | Type and lifetime | How it is used |
| --- | --- | --- |
| Transaction import result | Success, automatically removed after five seconds | Reports created, skipped, and intentionally imported duplicate counts; also warns when filters may hide imported rows. [`TransactionsPage.tsx`](../../src/features/transactions/pages/TransactionsPage.tsx#L292) |
| Import preview request failure | Error, persistent until dismissed or another attempt | `ImportButton` passes the error to the page-level import message handler. This contrasts with the later batch-import toast. [`useImportMessageHandler.ts`](../../src/features/transactions/hooks/useImportMessageHandler.ts#L81) |
| Invalid or disabled amount-filter currency | Warning, removed by clearing the invalid filter | Appears on the transaction page and saved-view page. Its “close” action actually resolves the condition. [`TransactionsPage.tsx`](../../src/features/transactions/pages/TransactionsPage.tsx#L299), [`ViewPage.tsx`](../../src/features/views/pages/ViewPage.tsx#L381) |
| Newly created statement format during import | Success, persistent until dismissed or workflow state changes | Confirms the format was saved and gives the next instruction: choose a statement file. [`ImportButton.tsx`](../../src/features/transactions/components/ImportButton.tsx#L406) |
| Currency creation failure | Error, persistent and contextual | Appears immediately above the create form. [`CurrencyCreatePage.tsx`](../../src/features/admin/currencies/pages/CurrencyCreatePage.tsx#L74) |
| Currency update failure | Error, persistent and contextual | Appears immediately above the edit form. [`CurrencyEditPage.tsx`](../../src/features/admin/currencies/pages/CurrencyEditPage.tsx#L135) |
| Currency created or updated after navigation | Success flash banner, automatically removed after five seconds | The create/edit page passes the message through router state; the destination list consumes it and clears the state. [`CurrenciesListPage.tsx`](../../src/features/admin/currencies/pages/CurrenciesListPage.tsx#L122) |
| Statement-format creation failure | Error, persistent and contextual | Appears above the create form. [`StatementFormatCreatePage.tsx`](../../src/features/admin/statement-formats/pages/StatementFormatCreatePage.tsx#L76) |
| Statement-format update failure | Error, persistent and contextual | Appears above the edit form. [`StatementFormatEditPage.tsx`](../../src/features/admin/statement-formats/pages/StatementFormatEditPage.tsx#L146) |
| Statement format created or updated after navigation | Success flash banner, automatically removed after five seconds | Same router-state flash pattern used by currencies. [`StatementFormatsListPage.tsx`](../../src/features/admin/statement-formats/pages/StatementFormatsListPage.tsx#L121) |
| User deactivation fails | Error, persistent until dismissed or retried | Dialog closes and the error appears on the user detail page. [`UserDetailPage.tsx`](../../src/features/admin/users/pages/UserDetailPage.tsx#L131) |
| CSV wizard step fails | Error, persistent and contextual | Appears inside the wizard; field-specific failures instead remain beside their fields. [`CsvStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/csv-wizard/CsvStatementFormatWizardDialog.tsx#L435) |
| PDF wizard step fails | Error, persistent and contextual | Same pattern inside the PDF wizard. [`PdfStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog.tsx#L1066) |
| Manual saved-view membership removal fails | Error, persistent until dismissed, retried, or the dialog closes | Keeps the removal dialog and its transaction selection available. [`RemoveViewTransactionsModal.tsx`](../../src/features/views/components/RemoveViewTransactionsModal.tsx#L90) |
| Transfer/refund-assisted removal fails | Error, persistent until dismissed, retried, or the dialog closes | Appears beside the mutation action without replacing the separate candidate-discovery error state. [`TransferRefundReviewDialog.tsx`](../../src/features/views/components/TransferRefundReviewDialog.tsx#L157) |
| Saved-view rename fails | Error, persistent until dismissed, retried, or the dialog closes | Preserves the edited name and keeps the rename dialog available. [`EditViewModal.tsx`](../../src/features/views/components/EditViewModal.tsx#L94) |
| Saved-view deletion fails | Error, persistent until dismissed, retried, or the dialog closes | Keeps the confirmation dialog open and leaves the user on the current view. [`DeleteViewModal.tsx`](../../src/features/views/components/DeleteViewModal.tsx#L78) |

The router-carried cases have a conventional name: **flash messages**.

## 3. Persistent Condition Callouts

These are not mutation-result messages. They describe a condition that remains
true, so the message remains until the condition resolves.

| Condition | Type | Use |
| --- | --- | --- |
| Disabled currencies or exchange rates still being imported | Warning callout | Reused on Transactions, saved-view detail, and Analytics. Pending rates provide a Refresh action; disabled currencies do not. [`MissingExchangeRatesBanner.tsx`](../../src/components/MissingExchangeRatesBanner.tsx#L19) |
| Transactions excluded because conversion is unavailable | Status callout | Appears directly above both the ordinary transaction table and saved-view table; automatically disappears when no transactions are excluded. [`TransactionTable.tsx`](../../src/features/transactions/components/TransactionTable.tsx#L435), [`ViewTransactionTable.tsx`](../../src/features/views/components/ViewTransactionTable.tsx#L344) |
| Saved-view memberships absent from the current snapshot | Status callout | Persistent diagnostic on the saved-view page. [`ViewPage.tsx`](../../src/features/views/pages/ViewPage.tsx#L389) |
| Add-to-view mutation fails or membership becomes stale | Inline error alert | Appears beside the selection/action bar and stays until selection changes or another attempt occurs. [`TransactionTable.tsx`](../../src/features/transactions/components/TransactionTable.tsx#L619) |
| Uploaded file was already imported | Warning alert | Persistent inside the preview dialog, with previous-import details. [`PreviewFileImportWarningBanner.tsx`](../../src/features/transactions/components/PreviewFileImportWarningBanner.tsx#L33) |
| CSV analysis or preview produces warnings | Warning callout | Server-provided warning list shown at the relevant wizard step. [`CsvStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/csv-wizard/CsvStatementFormatWizardDialog.tsx#L125) |
| PDF cannot be used to create a format | Blocking inline error state | Displays all unsupported reasons and changes the wizard’s available next steps. [`PdfStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog.tsx#L1093) |
| PDF transaction-table candidate has low confidence | Warning callout | Asks the user to review before continuing. [`PdfStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog.tsx#L1129) |
| PDF preview contains user-facing diagnostics | Warning callout | Shows diagnostic messages immediately above the preview table. [`PdfStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog.tsx#L1497) |

## 4. Blocking Notification

There is one true interruptive notification:

- **“Session Expiring”** is a modal warning with a live countdown and required
  Continue action. It cannot be dismissed through the usual dialog controls;
  expiry logs the user out. This is appropriately modal because it is
  time-sensitive, consequential, and requires action.
  [`InactivityWarningModal.tsx`](../../src/components/InactivityWarningModal.tsx#L26)

## 5. Persistent Load and Workflow Error States

`ErrorBanner` is really an **error state**, not a transient notification. It
displays the server message and error code, optionally with Retry, and remains
until the query succeeds or the user leaves.

Its 13 uses cover:

- Transactions and add-to-view target loading:
  [`TransactionsPage.tsx`](../../src/features/transactions/pages/TransactionsPage.tsx#L259),
  [`TransactionsPage.tsx`](../../src/features/transactions/pages/TransactionsPage.tsx#L83)
- Transaction detail:
  [`TransactionDetailPage.tsx`](../../src/features/transactions/pages/TransactionDetailPage.tsx#L146)
- Saved-view list and detail:
  [`ViewsPage.tsx`](../../src/features/views/pages/ViewsPage.tsx#L26),
  [`ViewPage.tsx`](../../src/features/views/pages/ViewPage.tsx#L301)
- Transfer/refund discovery inside its dialog:
  [`TransferRefundReviewDialog.tsx`](../../src/features/views/components/TransferRefundReviewDialog.tsx#L126)
- Analytics source:
  [`AnalyticsPage.tsx`](../../src/features/analytics/pages/AnalyticsPage.tsx#L175)
- Statement-format management:
  [`StatementFormatManagementPage.tsx`](../../src/features/statement-formats/pages/StatementFormatManagementPage.tsx#L93)
- Admin transaction and user searches:
  [`AdminTransactionsPage.tsx`](../../src/features/admin/transactions/pages/AdminTransactionsPage.tsx#L85),
  [`UsersListPage.tsx`](../../src/features/admin/users/pages/UsersListPage.tsx#L78)
- Admin user detail:
  [`UserDetailPage.tsx`](../../src/features/admin/users/pages/UserDetailPage.tsx#L88)
- CSV and PDF wizard non-field errors:
  [`CsvStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/csv-wizard/CsvStatementFormatWizardDialog.tsx#L438),
  [`PdfStatementFormatWizardDialog.tsx`](../../src/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog.tsx#L1069)

There are also older bespoke error states for admin currency/statement-format
loads, authentication failure, unauthorized access, router failure, and
uncaught React errors. These replace page content rather than notifying over
it.

## What Is Not a Notification

The following surfaces are classified separately:

- Confirmation dialogs ask permission before an action; they do not report an
  outcome.
- Field validation belongs beside the field.
- Loading indicators communicate progress.
- Empty states describe content absence.
- Duplicate markers and unavailable-conversion labels inside individual rows
  or cards are data annotations.
- Selection banners such as “All 10 transactions on this page are selected”
  are contextual controls or prompts.

There is no browser Notification API, push notification, notification center,
inbox, or persisted notification history.

## What This Says About Issue #2

The app already contains a recognizable rule:

- Load failure → persistent error state.
- Form or workflow failure → persistent inline banner.
- Cross-route success → flash banner on the destination.
- Continuing condition → persistent contextual callout.
- Required, time-sensitive action → modal.
- Background/global event → toast.
- Obvious successful direct manipulation → update the interface without a
  detached success notification.

The first pass removed mutation-success messages that duplicated an obvious
local result. The first contextual-error migration then moved both saved-view
membership-removal failures out of toasts and added the previously missing
rename and delete failures as persistent dialog alerts. Other retained
mutation-error toasts still violate the hierarchy: they use a global,
automatically disappearing surface for errors that should remain beside the
initiating surface.

`MessageBanner` now exposes errors as atomic `role="alert"` messages and its
success and warning variants as atomic `role="status"` messages. Other shared
and bespoke feedback, including `ErrorBanner` and
`MissingExchangeRatesBanner`, does not yet follow one consistent status-message
contract. The application therefore has an accessible shared contextual banner
without a complete application-wide status-message migration.
