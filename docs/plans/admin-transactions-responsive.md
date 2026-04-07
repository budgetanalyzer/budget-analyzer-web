# Admin Transactions: Responsive Layout Fixes

## Context

The admin transactions view (`src/features/admin/transactions/pages/AdminTransactionsPage.tsx`) doesn't reflow well at narrow widths (e.g. half-screen tile in i3, ~960px viewport). Two specific symptoms:

1. **Filter form looks awkward.** The Search button ends up wedged between two rows of input fields when the form wraps.
2. **Table is too wide.** All 8 data columns render at full width and the table scrolls horizontally — but `scrollbar-hide` (`src/components/ui/Table.tsx:7`) means there's no visible cue that scrolling is even possible.

The regular user `TransactionsPage` (`src/features/transactions/pages/TransactionsPage.tsx`) behaves better at the same width. The differences explain why.

### Diagnosis

**Available horizontal space at ~960px viewport:**

| | Sidebar | Outer padding | Usable content |
|---|---|---|---|
| Regular `Layout.tsx:98` | none | `container mx-auto px-4` | ~736px |
| `AdminLayout.tsx:292` + `AdminTransactionsPage.tsx:70` | 256px (`w-64`) | `container mx-auto px-8` | ~640px |

The admin view starts with ~100px less room and applies an extra 32px of padding on top of that.

**Filter form — the "search button between two rows" bug:**

- User: `TransactionTable.tsx:442` uses `flex items-center gap-2` (no wrap). Items stay on one line; they overflow off-screen but never reflow.
- Admin: `AdminTransactionFilters.tsx:106` uses `flex flex-wrap items-center gap-2`. The Search button sits in the middle of the flex children (after Min/Max, before Clear all), so when the row wraps the button can land on its own line wedged between rows of inputs.

A second `flex flex-wrap` row at `AdminTransactionFilters.tsx:172` for owner/bank/account compounds the awkwardness — what's meant to be a 2-row form becomes a jumbled 3-4 row form.

**Table — the "too wide" issue:**

- Both tables are wrapped in `Table.tsx:7` which already has `overflow-x-auto scrollbar-hide`. So both technically scroll horizontally, but the hidden scrollbar removes the visual cue.
- User columns (`TransactionTable.tsx:226-321`): select(50), date(120), description(400/min200), bank(150), account(180), type(100), amount(150), actions(60). 8 cols but with explicit `size`/`minSize`/`maxSize` and width classes via `columnWidth.ts:6`. The select+actions columns are tiny (50/60px).
- Admin columns (`AdminTransactionTable.tsx:148-243`): date, description, bank, account, type, amount, **ownerId**, **createdAt**. 8 *data* columns, no widths set, relying on browser auto-layout. Two extra columns the user table doesn't have, and `accountId` displays the full opaque ID in font-mono.

**Core difference:** the regular page was tuned for tight space (fixed widths, single-line filter row, fewer columns). The admin page was built desktop-first — more columns, more filters, wrap-friendly form — but the wrap behavior was never tested at narrow widths and column widths were never constrained.

---

## Options

These are independent and can be mixed. Cheapest first within each section.

### Filter form

#### Option F1 — Move Search/Clear to their own row

Group all inputs in one `flex flex-wrap` block, then put `Search` + `Clear all` in a separate row below. Buttons never end up wedged between fields.

- **Files:** `AdminTransactionFilters.tsx`
- **Effort:** Smallest. ~10 lines of JSX restructure.
- **Tradeoff:** Always uses an extra row even on wide screens.

#### Option F2 — Responsive grid

Wrap the form in a responsive grid (e.g. `grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2`) with `col-span-full` on the action row. More predictable layout, no surprise wrap order.

- **Files:** `AdminTransactionFilters.tsx`
- **Effort:** Medium. Need to think through breakpoints and which inputs should span which cells.
- **Tradeoff:** Heavier rewrite. Cells are uniform width which can look odd for very different control sizes (Type select vs description input).

#### Option F3 — "More filters" disclosure

Keep Search + Date + Type visible always. Tuck Min/Max/Owner/Bank/Account into an expandable panel (e.g. a `<details>` or shadcn `Collapsible`).

- **Files:** `AdminTransactionFilters.tsx` (+ possibly a new `Collapsible` import)
- **Effort:** Medium. Need to decide what's "primary" vs "advanced".
- **Tradeoff:** Hides functionality behind a click. Big improvement at narrow widths and matches how the user-facing form keeps fewer always-visible controls.

#### Option F4 — Tighten admin page padding

Drop `container mx-auto px-8 py-10` on `AdminTransactionsPage.tsx:70` to something like `px-4 py-6` (or `px-4 sm:px-6 lg:px-8`). Buys ~32px of horizontal room everywhere in the admin section.

- **Files:** `AdminTransactionsPage.tsx` (and potentially other admin pages for consistency — `AdminDashboardPage`, currencies, statement formats, etc.)
- **Effort:** Small for one page, larger if applied consistently across the admin section.
- **Tradeoff:** Affects all admin pages, not just transactions. Worth considering as a global admin spacing decision.

### Table

#### Option T1 — Hide low-value columns at narrow widths

`createdAt` and `ownerId` are the obvious candidates. Use `hidden lg:table-cell` on the `<TableHead>` and `<TableCell>` for those columns. Owner can still be filtered via the form.

- **Files:** `AdminTransactionTable.tsx`
- **Effort:** Small. Add a `meta` field to each `ColumnDef` (e.g. `meta: { headerClassName: 'hidden lg:table-cell', cellClassName: 'hidden lg:table-cell' }`) and apply in the `TableHead`/`TableCell` render. Or hardcode classNames per column.
- **Tradeoff:** Loses information density at narrow widths. Acceptable if you accept that admins on narrow screens will widen to see those columns.
- **Candidates by priority to hide:** `createdAt` first (lowest signal), then `ownerId` (still filterable), then maybe `bank`/`account` if going extreme.

#### Option T2 — Explicit column widths + `table-fixed`

Mirror the pattern in `columnWidth.ts:6` and `TransactionTable.tsx:263`. Add `size`/`minSize`/`maxSize` to each `ColumnDef`, add a `table-fixed` class to the `<table>`, and `truncate` long cells. Browser stops guessing.

- **Files:** `AdminTransactionTable.tsx`, possibly `columnWidth.ts` (add new entries if needed)
- **Effort:** Medium. Need to pick widths for all 8 columns.
- **Tradeoff:** Requires combining with T1 or T3 to actually fit in narrow widths — explicit widths alone just make the overflow more predictable, they don't make it fit.

#### Option T3 — Show the horizontal scrollbar

Drop `scrollbar-hide` from `Table.tsx:7` (or scope it so the admin table opts back in to a visible scrollbar). Lowest-effort fallback if you don't want to hide columns.

- **Files:** `Table.tsx` or `AdminTransactionTable.tsx`
- **Effort:** Smallest. One className change.
- **Tradeoff:** Affects every table in the app if changed in `Table.tsx`. Scrollbar styling can look heavy. Doesn't actually solve "too wide" — just makes the existing scroll discoverable.

#### Option T4 — Stack as cards at narrow widths

Below `md:`, render each row as a card/list item — date+amount on one line, description below, bank/account/owner as small chips. Above `md:`, render the regular table.

- **Files:** `AdminTransactionTable.tsx` (significant additions)
- **Effort:** Largest. New component, dual rendering paths, sorting/pagination still needs to work.
- **Tradeoff:** Most "responsive-looking" result. Probably overkill for an admin tool but the most polished outcome.

#### Option T5 — Truncate `accountId` cell

Show last 4–6 chars of the opaque accountId with the full value in a `title` tooltip. Currently the full font-mono string eats a lot of width.

- **Files:** `AdminTransactionTable.tsx` (cell render at lines 173-183)
- **Effort:** Smallest. ~3 lines.
- **Tradeoff:** Slightly less scannable for admins who actually compare accountIds visually — tooltip restores full value on hover.

---

## Recommended combo

Low effort, high payoff:

- **F1** — Move Search/Clear to their own row
- **F4** — Tighten admin page padding (`px-4 py-6`)
- **T1** — Hide `createdAt` and `ownerId` below `lg:`
- **T5** — Truncate `accountId` cell

This resolves both reported symptoms without restructuring components. If the table still feels cramped after T1, layer in **T2** (explicit widths + `table-fixed`) so the remaining columns resize predictably.

Polish layer (do later if desired):

- **F3** — "More filters" disclosure for owner/bank/account
- **T4** — Card stack at `<md:` widths

---

## Decisions

Currently implemented: **F1 + F3 + F4 + T2 + T5 + column removal + owner filter removal**.

- [x] **F1** chosen — Search + Clear all moved to their own row at the bottom of the form. Clear all is always rendered and `disabled` when no filters are active. Still in place after the F3 layer — the action row remains the final row of the form.
- [x] **F3** chosen — "More filters" disclosure layered on top of F1. The primary row keeps only the description search + date range + the `More filters` toggle button. Min/Max, Type, Bank name, and Account ID move into a collapsible panel (plain `useState` + conditional render; no new dependency). The toggle shows a count badge of how many hidden filters are currently applied and uses `aria-expanded` / `aria-controls` for a11y. The panel auto-opens on mount or query change when any of its fields are active (e.g. deep links), but never auto-closes — the user stays in control. Note: Type was moved *into* the disclosure (originally F3 suggested keeping it always-visible) so the primary row fits comfortably at ~640px admin content width.
- [x] **F4** applied to `AdminTransactionsPage` only (`px-4 py-6`). Not rolled out to other admin pages yet — see follow-ups below if we want a global admin spacing pass.
- [x] **T2** — explicit column widths, matching the pattern in `src/features/transactions/components/TransactionTable.tsx`. The 6 remaining columns have `size`/`minSize`/`maxSize` and `columnWidthClass(...)` is applied to **both** `<TableHead>` and each body `<TableCell>` (and the skeleton row). `<Table>` is left as auto-layout (no `table-fixed`) so the browser can flex columns within their min/max bounds — same as the user view. Long-text cells (`description`, `bankName`) use inner `<div className="truncate">` to clip overflow. Widths: date 120 fixed, description 400 (min 200, no max — flexes like user), bank 150 (min 120), account 100 fixed, type 100 fixed, amount 150 (min 130).
- [x] **T5** — `accountId` cell shows `…` + last 6 characters with the full value in a `title` tooltip. Strings ≤6 chars render verbatim.
- [x] **Column removal** — `ownerId` and `createdAt` columns dropped from the table view entirely. Both fields are still returned by the API and remain filterable (owner) — they will live in a per-row detail view (TBD). Removed the now-unused `220` entry from `src/utils/columnWidth.ts` and the `formatTimestamp` import from `AdminTransactionTable.tsx`. This supersedes the earlier T1 attempt (hiding via `hidden lg:table-cell`) and the T2 widths for those two columns.
- [x] **Owner filter removal** — the free-text `ownerId` filter input (and its "opaque identifier" disclaimer) is removed from `AdminTransactionFilters`. Typing an opaque `usr_…` id was never a realistic admin workflow. `ownerId` remains in `AdminTransactionsQuery`, the URL contract (`ADMIN_TXN_PARAMS.OWNER_ID`), and `hasActiveFilters` so that (a) deep links with `?ownerId=…` still work, (b) `Clear all` still clears it, and (c) a future "click a user to filter their transactions" workflow can set it programmatically without schema changes. `draftToQueryPatch` no longer emits `ownerId`, so submitting the form preserves any pre-existing `ownerId` in the URL instead of clobbering it. See follow-up below for the replacement UX.
- [~] **T1** — initially implemented (`ownerId` and `createdAt` hidden below `lg:` via `hidden lg:table-cell` with a shared `NARROW_HIDDEN_COLUMN_IDS` set). **Reverted** in favour of T2, then superseded by full removal — see above.
- [x] **T3** — admin-only opt-in to a visible scrollbar. Added a `hideScrollbar` prop to `Table` (`src/components/ui/Table.tsx`) defaulting to `true` so existing tables are unaffected. `AdminTransactionTable` passes `hideScrollbar={false}`. Other tables continue to suppress the scrollbar. With the two columns now removed the admin table may no longer overflow at typical widths, but the visible scrollbar remains as a safety net.
- [ ] **F4 globally** — open question whether to apply `px-4 py-6` to `AdminDashboardPage`, currencies, statement formats, etc. for consistency.
- [ ] **Detail view** — per-row detail surface that shows `ownerId`, `createdAt`, and any other low-density fields not in the table.
- [ ] **Owner filter replacement UX** — now that free-text `ownerId` entry is gone, admins need another way to filter by owner. Options to explore: (1) a users/owners admin page with a "View transactions" action that navigates to `/admin/transactions?ownerId=…`; (2) clicking the owner chip inside the per-row detail view to pin that owner as an active filter + visible chip above the table; (3) a typeahead user picker backed by an admin users search endpoint. (1) is likely the cheapest starting point and depends only on the detail view follow-up.

---

## Out of scope

- Reworking the AdminLayout sidebar width or making it collapsible at narrow widths (separate concern, see `collapsible-admin-sidebar.md`).
- Backend changes to the admin transactions API.
- Adding new filters or columns.
