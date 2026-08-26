# View Dialog and Notification Consistency Audit

## Status and Goal

Open audit issue. Address the findings independently and close each checklist
item only after its intended product behavior and applicable tests are in place.

Make saved-view dialogs and mutation feedback feel like one interface while
preserving the repository's strict CSP requirements. This audit records source
evidence, not AI authorship: several inconsistencies are shared with older
transaction UI or originate in shared primitives.

## Audit Scope

The review compared:

- saved-view removal and transfer/refund review dialogs;
- create, rename, and delete view dialogs;
- single and bulk transaction deletion dialogs;
- the custom toast system and inline transaction message banners; and
- the shared dialog primitive used by both older and newer features.

No live-browser audit was performed. Visual findings below follow directly from
the rendered component structure and Tailwind classes; interaction and
accessibility findings follow from the shared primitive and dialog callbacks.

## Candidate UX Reference Set

No single resource is a complete UX equivalent of Bulletproof React. The most
useful engineering default is a small stack in which each source owns a
different kind of decision:

- [Refactoring UI](https://www.refactoringui.com/) for visual hierarchy,
  spacing systems, typography, color, depth, and finishing details. It is aimed
  explicitly at developers and is the closest fit for subtle visual polish in
  this Tailwind-first repository.
- [Carbon Design System usage guidance](https://carbondesignsystem.com/components/overview/)
  for component selection and behavior without adopting Carbon's React
  implementation or IBM visual identity. Its guidance for
  [notifications](https://carbondesignsystem.com/components/notification/usage/),
  [modals](https://carbondesignsystem.com/components/modal/usage/), and
  [buttons](https://carbondesignsystem.com/components/button/usage/) directly
  covers several findings in this audit.
- [Nielsen Norman Group's usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
  as a product-review checklist, especially visibility of system status,
  consistency and standards, error prevention, minimalist design, and error
  recovery.
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/patterns/)
  as the interaction-accessibility contract. Its
  [modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  defines dialog semantics, focus placement and containment, Escape behavior,
  and focus restoration.

[Practical UI](https://www.practical-ui.com/) is a broader visual-design
alternative to Refactoring UI. The
[GOV.UK Design System](https://design-system.service.gov.uk/) is a useful
specialist reference for forms, validation, errors, warnings, and researched
task flows, although its visual personality and service focus are less directly
applicable to a financial dashboard.

## Findings

### 1. Compact confirmations have no content-to-footer spacing

**Status:** Resolved

[`RemoveViewTransactionsModal`](../../src/features/views/components/RemoveViewTransactionsModal.tsx)
places `DialogFooter` immediately after `DialogHeader` without margin, padding,
or a container gap. The shared
[`DialogContent` and `DialogFooter`](../../src/components/ui/Dialog.tsx) do not
provide vertical separation either. The description and buttons therefore
render as separate blocks but with essentially no breathing room.

This is not unique to saved views:
[`BulkDeleteModal`](../../src/features/transactions/components/BulkDeleteModal.tsx)
has the same structure. The older single-transaction
[`DeleteTransactionModal`](../../src/features/transactions/components/DeleteTransactionModal.tsx)
looks more deliberate because its transaction summary adds `my-4` between the
header and footer. Long review dialogs explicitly use `border-t pt-4`, while
statement-format dialogs use `mt-6 gap-2`, demonstrating further local spacing
conventions.

- [x] Choose one compact confirmation spacing convention.
- [x] Apply it to saved-view and transaction confirmations that have adjacent
      headers and footers.
- [x] Verify desktop and mobile button spacing; the base footer reverses its
      column on mobile but supplies no mobile gap.

The shared `DialogFooter` now owns `mt-6` content separation and `gap-2` button
spacing at every breakpoint. This applies the convention to compact
confirmations throughout the application and makes it the default for future
dialogs. Existing feature-local copies were removed, and content with trailing
padding was normalized so it does not compound the shared footer margin.

### 2. Mutation success feedback has two different visual languages

**Status:** Open

The [application notification inventory](../research/notification-inventory.md)
enumerates the current production notification surfaces and classifies their
scope, semantic type, lifetime, and use. It identifies the existing pattern as
a contextual feedback hierarchy: feedback belongs at the narrowest scope that
contains the event, with persistence proportional to consequence and
actionability.

At the time of the audit, both
[`RemoveViewTransactionsModal`](../../src/features/views/components/RemoveViewTransactionsModal.tsx)
and
[`TransferRefundReviewDialog`](../../src/features/views/components/TransferRefundReviewDialog.tsx)
reported success through `toast.success`. The custom
[`Toast`](../../src/components/ui/Toast.tsx) is a solid-color floating card in a
top-right viewport. [`Toaster`](../../src/components/ui/Toaster.tsx) dismisses
it after five seconds, renders only description text, and uses a close control
that is visually hidden until hover or focus.

By contrast, transaction imports and page conditions use
[`MessageBanner`](../../src/components/MessageBanner.tsx): an inline,
lightly-tinted surface with a status icon, medium-weight text, motion, and an
always-visible close button. This is the banner presentation users may perceive
as the application's normal messaging.

The removal flows are consistent with older transaction edit and delete
mutations, which also use toasts. The inconsistency is therefore application
wide rather than solely a regression in the view feature. The custom toast
must remain CSP-safe; the repository specifically prohibits returning to
Sonner or another runtime-style-injecting dependency.

[`API integration`](../api-integration.md#user-facing-error-messages) now owns
the first-pass success-feedback rule and records the retained transient
mutation-error behavior as unresolved work.

#### External guidance and toast consensus

There is no industry consensus that toasts should be the default feedback
mechanism, nor is there a consensus that they must never be used. Mature
guidance converges on a much narrower role:

- [Carbon notification guidance](https://carbondesignsystem.com/components/notification/usage/)
  defines a toast as a short, non-modal, time-based message. Carbon says
  notifications are disruptive and should be used sparingly. If a toast
  disappears automatically, information that users may need to read or consult
  later must remain available elsewhere. Its inline notifications instead
  appear near the related task and persist until dismissed or resolved.
- [NN/g's communication-method guidance](https://www.nngroup.com/articles/indicators-validations-notifications/)
  distinguishes feedback tied to an immediate user action from notifications
  about system events. It warns that passive notifications are easily missed
  and gives an example in which a fading toast was a poor error presentation.
  Its broader
  [error-message guidance](https://www.nngroup.com/articles/error-message-guidelines/)
  recommends placing errors close to their source and preserving user effort.
- [WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  does not require a particular visual surface. It requires important status
  changes to be programmatically determinable so assistive technology can
  announce them without moving focus.

The practical consensus is therefore: reserve a toast for brief, low-risk,
nonessential information that needs no response and may safely be missed. Do
not make an automatically disappearing toast the sole carrier of an error,
required action, recovery instructions, or information the user may need to
reference. Avoiding toasts entirely is a reasonable product choice when every
event has a stable contextual surface.

#### Candidate Budget Analyzer rule

The following no-toast-by-default policy would be consistent with that
guidance and with the product owner's stated preference:

- Let the changed interface provide success feedback when the result is already
  obvious, such as a removed row disappearing and totals updating.
- When explicit confirmation adds value, render a lightweight `role="status"`
  message near the affected table, form, or control rather than at a detached
  viewport corner.
- Keep mutation errors beside the initiating dialog or control until the user
  retries, resolves, or dismisses them. Preserve selections and form input.
- Use a page-level banner for page-wide or cross-cutting state, and keep
  important or actionable messages persistent.
- Reserve a toast only for a background or out-of-context event that has no
  sensible stable surface, or choose not to support that exception.

The first implementation pass removed eight `toast.success` branches and the
redundant user-deactivation success banner. Inline and detail edits, single and
fully successful bulk deletion, statement-format hide and restore, both
saved-view membership-removal flows, and user deactivation now rely on their
visible interface changes. Messages remain for failures, partial or zero-result
outcomes, non-obvious counts and consequences, next steps, cross-route results,
ongoing conditions, and background or global events.

This does not resolve the finding. Mutation errors still use transient toasts,
and the replacement surface, toast appearance and touch behavior, and status-
message accessibility remain open decisions.

- [x] Decide the product rule for transient mutation success versus persistent
      page-level status.
- [ ] Decide whether toast styling should visually align more closely with
      `MessageBanner` while remaining a floating, transient surface.
- [ ] Ensure close affordances remain discoverable on touch devices.
- [x] Record the durable notification rule in the appropriate owner document.
- [ ] Replace retained transient mutation-error toasts with an agreed
      contextual, persistent surface.
- [ ] Define and implement accessible status-message semantics for retained
      explicit feedback.

### 3. The same removal operation changes semantic button treatment

**Status:** Open

Manual removal uses a red `destructive` confirmation button in
[`RemoveViewTransactionsModal`](../../src/features/views/components/RemoveViewTransactionsModal.tsx),
while transfer/refund review uses the default primary button in
[`TransferRefundReviewDialog`](../../src/features/views/components/TransferRefundReviewDialog.tsx).
Both submit the same saved-view membership-removal request and both explicitly
state that the transactions are not deleted.

- [ ] Decide whether removing membership is destructive within this product's
      button taxonomy.
- [ ] Use the same variant for manual and assisted removal.

### 4. Rename and delete view failures have no user-facing feedback

**Status:** Open

[`EditViewModal`](../../src/features/views/components/EditViewModal.tsx) supplies
only an `onSuccess` callback. [`DeleteViewModal`](../../src/features/views/components/DeleteViewModal.tsx)
also supplies only `onSuccess`. Their hooks invalidate data but do not provide
global error presentation. A failed request therefore leaves the dialog open
and re-enables its controls without explaining what happened.

Removal, transaction edit, and transaction deletion mutations all show an
error toast, so the absence is inconsistent with both current documentation
and nearby mutation behavior.

- [ ] Add normalized, user-facing mutation failure feedback to rename and
      delete.
- [ ] Keep the dialog and user input intact after failure.
- [ ] Add behavior tests for the failure paths.

### 5. Pending dialogs expose inconsistent dismissal behavior

**Status:** Open

The transfer/refund review hides its close icon and rejects dismissal while its
mutation is pending. Compact removal and bulk transaction deletion reject the
dismissal callback but leave the close icon visible, making it appear clickable
even though it is inert. Rename, delete-view, and single-transaction deletion
allow close-icon, backdrop, or Escape dismissal while their mutation is
pending.

- [ ] Choose whether pending mutations may be dismissed.
- [ ] When dismissal is blocked, make every dismissal affordance accurately
      reflect that state.
- [ ] Apply the rule consistently to close icon, backdrop click, Escape, and
      Cancel.

### 6. Dialog hierarchy and copy conventions drift across view actions

**Status:** Open

Saved-view titles mix sentence case (`Remove from view`, `Review possible
transfers and refunds`) with title case (`Rename View`, `Delete View`). Delete
view adds a warning icon and extra title-to-description padding; removal does
not. Single-transaction deletion shows the affected transaction's date,
description, and amounts, whereas removing one transaction from a view confirms
only a count.

Some differences may be intentional because deletion and membership removal
have different consequences. They still need an explicit convention so visual
hierarchy and confirmation context do not depend on which component was built
most recently.

- [ ] Standardize dialog title casing.
- [ ] Define when destructive confirmations receive warning iconography.
- [ ] Decide what transaction context is required for single-item membership
      removal versus bulk removal.

### 7. The shared dialog primitive lacks standard dialog semantics and focus management

**Status:** Open

The shared [`Dialog`](../../src/components/ui/Dialog.tsx) renders the modal
content as a plain `div`. It does not provide `role="dialog"`, `aria-modal`,
title/description associations, initial focus placement, focus containment, or
focus restoration. It installs Escape and backdrop dismissal and a body scroll
lock, but those behaviors do not supply the missing semantics or keyboard focus
lifecycle.

This affects both older transaction dialogs and current saved-view dialogs; it
is shared-component debt, not a view-only inconsistency.

- [ ] Define the required accessible dialog contract without adding a
      runtime-style-injecting dependency.
- [ ] Implement semantics and focus behavior in the shared primitive rather
      than independently in feature dialogs.
- [ ] Add focused shared-component tests and browser verification where DOM
      emulation cannot establish real focus behavior.

## Suggested Resolution Order

1. Fix compact confirmation spacing.
2. Standardize the removal action variant.
3. Add missing rename and delete error feedback.
4. Standardize pending dismissal behavior.
5. Decide and document the notification presentation rule.
6. Normalize remaining dialog hierarchy and confirmation context.
7. Upgrade shared dialog semantics and focus management as a dedicated,
   higher-risk change.

Items 1 through 6 can be handled separately. Item 7 affects every dialog and
should receive its own implementation and verification pass.

## Completion Criteria

- Each checklist above is completed or intentionally rejected with rationale.
- Equivalent membership-removal actions use equivalent visual and interaction
  treatment.
- Compact dialogs have deliberate desktop and mobile spacing.
- Every view mutation provides success visibility through the changed UI or a
  documented notification surface and provides explicit failure feedback.
- Pending dismissal behavior is consistent across all dismissal mechanisms.
- The shared dialog contract meets the agreed semantic and focus requirements.
- Applicable unit and browser behavior tests cover the resulting contracts.
