# PDF Statement Format Wizard Validation UX Plan

**Status:** Implemented
**Scope:** budget-analyzer-web

## Goal

Improve the PDF statement-format wizard validation experience so required
fields are visible on open, but empty untouched fields are not immediately shown
as errors. Users should be able to click the preview action to discover what is
missing, then fix fields with clear inline feedback.

This plan applies first to the PDF wizard mapping step in
`src/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog.tsx`.
If the resulting pattern is clean, apply the same form-field conventions to the
CSV wizard in a separate pass.

## Current Problem

The PDF wizard currently derives `canPreview` from required values and disables
`Preview Mapping` whenever any required field is missing. That makes the action
state accurate, but opaque: the user cannot click the action to learn what is
missing, and required empty fields can feel like errors before the user has made
an action attempt.

## UX Rules

- Mark required fields subtly as soon as the form opens, using visible text such
  as `Required` near the label. Do not use red styling for untouched empty
  fields.
- Keep blocking validation errors hidden while the mapping form is pristine.
- After a field is touched, validate that field on blur. Do not validate every
  untouched required field just because the user typed in one field.
- When the user clicks `Preview Mapping`, validate all required fields.
- After the first preview attempt, keep validation eager for the fields that are
  invalid so messages disappear as soon as the user fixes them.
- Use red only for blocking errors. Use amber/yellow only for warnings where the
  user can continue.
- Do not rely on color alone. Pair invalid styling with short inline text such
  as `Required`, `Select a column`, or `Enter a date format`.
- Do not use tooltips. All required context must be visible inline.

## Button Behavior

Change `Preview Mapping` from a validation-gated disabled button to an enabled
action whenever previewing is structurally possible:

- Enabled when a PDF sample and candidate exist and the preview mutation is not
  pending.
- Disabled only for pending API work or impossible workflow states, such as no
  selected sample/candidate.
- On click, run client-side validation for the mapping step.
- If validation fails, stay on the mapping step, render field-level errors, and
  focus the first invalid control if practical.
- If validation passes, call the existing preview mutation.

Keep `Save Format` gated by successful parser preview and pending state. It can
also run the same validation before saving to guard against edits made after
returning from preview.

## Required Field Markers

Add a small reusable required indicator for wizard fields, for example:

```text
Display name  Required
```

Use muted text, not destructive text. Apply it to:

- `Display name`
- `Bank name`
- `Default currency`
- `Date column`
- `Date format`
- `Description column`
- `Amount column` and `Negative amount meaning` in signed amount mode
- `Debit column` and `Credit column` in debit/credit mode

Optional controls, such as `Account ID` and `Type column`, should be marked
optional only if the current form style already does that elsewhere. Otherwise
leave them unmarked.

## Validation State

Introduce explicit form validation state instead of deriving all UI feedback
from `canPreview` and backend `fieldErrors`:

- `touchedFields`: tracks fields blurred by the user.
- `submitAttempted`: tracks whether the user has clicked `Preview Mapping` or
  `Save Format`.
- `clientFieldErrors`: derived from current form state and mapping state.

Render a client-side error when:

- the field has a client error, and
- the field is touched or `submitAttempted` is true.

Continue rendering backend `fieldErrors` from `ApiError` beside matching fields.
When both client and backend errors exist for the same field, prefer the
client-side error if the current value is still locally invalid; otherwise show
the backend error.

## Validation Rules

Client-side validation should cover only obvious local requirements:

- `displayName`: trimmed value required.
- `bankName`: trimmed value required.
- `defaultCurrencyIsoCode`: trimmed value required.
- `mapping.dateHeader`: required.
- `mapping.dateFormat`: required when a date column is selected, and required
  before preview.
- `mapping.descriptionHeader`: required.
- signed amount mode:
  - `mapping.amountHeader`: required.
  - `mapping.negativeMeans`: required.
- debit/credit mode:
  - `mapping.debitHeader`: required.
  - `mapping.creditHeader`: required.

Keep parser-specific validation on the API. Do not attempt to validate date
format semantics beyond simple presence unless an existing shared utility or API
contract already supports it.

## Styling

For invalid controls, use existing Tailwind tokens and component conventions:

- Add `aria-invalid` where supported.
- Add `aria-describedby` linking the control to its error message.
- Use `border-destructive` or an existing destructive input state for invalid
  controls.
- Render messages with `text-sm text-destructive`.

For required markers, use muted text such as `text-xs text-muted-foreground`.
Do not add inline `style={...}` props.

For warnings, keep existing `border-warning/40 bg-warning/10 text-warning`
patterns.

## Implementation Steps

1. Add local field identifiers for the PDF wizard mapping fields.
2. Add helpers to validate the current `formState`, `mapping`, and amount mode.
3. Add `touchedFields` and `submitAttempted` state.
4. Add `onBlur` handlers to text inputs and select triggers where feasible.
5. Add a small label helper or component that renders the subtle `Required`
   marker.
6. Update `ColumnSelect` to accept required, touched/error metadata, and ARIA
   attributes.
7. Replace `canPreview` as the main disabled-button guard with a click-time
   validation path.
8. Keep existing API field-error mapping, but merge it with client-side errors.
9. Clear stale API errors for a field when that field changes, if the current
   component structure allows it without broad churn.
10. Focus the first invalid field after a failed preview attempt if a small,
    maintainable ref map is practical; otherwise leave this as a follow-up.

## Tests

Add or update tests in
`src/components/statement-formats/pdf-wizard/__tests__/PdfStatementFormatWizardDialog.test.tsx`:

- Opening the mapping step shows required markers but no red required errors.
- Blurring an empty required text field shows only that field's error.
- Editing one field does not reveal errors for every other required field.
- Clicking `Preview Mapping` with missing required fields shows all blocking
  missing-field errors and does not call the preview mutation.
- After a failed preview attempt, fixing a field removes its client-side error.
- `Preview Mapping` remains enabled before validation when a sample and candidate
  are present.
- Backend 422 `fieldErrors` still render beside the matching controls.

## Acceptance Criteria

- Empty required fields are not shown as errors when the mapping form first
  opens.
- Required fields are visibly marked on initial render.
- Users can click `Preview Mapping` to learn what is missing.
- Client-side validation errors are field-specific before submit and form-wide
  only after an action attempt.
- No inline styles, tooltips, or new UI dependencies are introduced.
- `npm run lint:fix` and the focused PDF wizard test file pass.
