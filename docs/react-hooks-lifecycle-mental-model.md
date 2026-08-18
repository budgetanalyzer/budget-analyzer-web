# React Hooks, Lifecycle, and Effects

This guide owns the repository's React lifecycle and effect conventions. Read it
before adding or changing hooks, effects, subscriptions, timers, or state derived
from other values. State placement beyond component lifecycle belongs to
[State architecture](state-architecture.md).

## Render, Commit, and Synchronize

Think in terms of rendering and synchronization rather than class lifecycle
methods:

1. React calls the component to calculate UI from the current props and state.
   That render is a snapshot and must stay pure: it must not change the DOM,
   start timers, subscribe to events, or perform requests.
2. A state setter queues another render. It does not change the state snapshot
   already visible to the running event handler or render.
3. React commits the calculated changes to the DOM.
4. Effects run after a commit to synchronize a non-React system with the
   committed props and state.

Event handlers are not part of rendering. They run because a specific
interaction occurred and are the normal place for submissions, mutations, and
other user-triggered work.

`useState` stores information that must survive renders and whose change must
render new UI:

```tsx
const [open, setOpen] = useState(false);
```

Calling `setOpen(true)` requests another render. When the next render runs,
`open` contains the new snapshot. Use a lazy initializer when calculating the
initial value is expensive or reads a browser preference:

```tsx
const [preference, setPreference] = useState(() => readInitialPreference());
```

Hooks must be called unconditionally at the top level of a component or custom
hook. Do not call them in branches, loops, callbacks, or after an early return.

## Effects Synchronize External Systems

An effect is appropriate when a rendered component must connect to, update, or
disconnect from something React does not control. Examples include DOM and
browser APIs, event listeners, timers, `BroadcastChannel`, and third-party
imperative widgets.

```tsx
useEffect(() => {
  const handleResize = () => setWidth(window.innerWidth);

  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

The setup runs after the component is committed. If a dependency changes,
React first runs the previous cleanup with the old values and then runs setup
with the new values. Cleanup also runs when the component unmounts. Anything
that installs or acquires a resource must release that same resource: remove
listeners, clear timers, unsubscribe, close channels, and release locks.

In development Strict Mode, React runs an extra setup-cleanup-setup cycle on
mount to expose incomplete cleanup. Code must behave correctly under that
cycle. Consequently, `[]` means an effect is tied to each mount; it does not
mean a setup can be assumed to execute only once for the lifetime of the
application.

### Dependencies

The dependency list describes every reactive value read by the effect: props,
state, and functions or variables declared in the component. React compares
each dependency with its previous value using `Object.is`.

- No dependency list: setup runs after every commit.
- `[]`: setup runs when that component instance mounts, with cleanup on
  unmount.
- `[roomId, enabled]`: setup runs on mount and again when either value changes.

Do not omit a dependency to control timing. Change the code so the value is no
longer reactive, define an effect-only helper inside the effect, or stabilize a
function with `useCallback` when stable identity is part of the design. The
hooks linter is a correctness check, not an obstacle to bypass.

Split unrelated synchronization into separate effects. Keep setup and teardown
for one external resource together in the same effect.

## Current Repository Examples

- [`useActivityTracking`](../src/hooks/useActivityTracking.ts) subscribes to
  window activity events and removes every listener in cleanup.
- [`useCountdown`](../src/hooks/useCountdown.ts) synchronizes displayed time
  with the clock and clears its interval whenever the inputs change or the hook
  unmounts.
- [`Dialog`](../src/components/ui/Dialog.tsx) acquires the shared body scroll
  lock only while open and returns its release function; its keyboard listener
  is installed and removed by a separate effect.
- [`useSessionHeartbeat`](../src/hooks/useSessionHeartbeat.ts) coordinates
  timers, a `BroadcastChannel`, session refreshes, and browser navigation. Its
  cleanup clears timers and closes the channel. This is session-lifecycle
  coordination, not a pattern for caching ordinary API data.

These examples demonstrate external-system synchronization. They are not a
reason to move calculations or event-driven work into effects.

## Work That Does Not Need an Effect

### Derived values

If a value can be calculated from current props, state, or query data, calculate
it during render. Do not store a second copy and synchronize it with an effect.

```tsx
const visibleTransactions = transactions.filter(matchesFilters);
const total = visibleTransactions.reduce(sumAmounts, 0);
```

Use `useMemo` only when the calculation is measurably expensive or a stable
reference is required by another API:

```tsx
const visibleTransactions = useMemo(
  () => transactions.filter(matchesFilters),
  [transactions, matchesFilters],
);
```

Filtered TanStack Table rows are also derived state. Read the table's row model
during render or when an action needs it. Do not copy filtered rows into parent
state from an effect; that creates an extra render, two sources of truth, and a
stale intermediate state.

### Event-driven work

If work happens because the user clicked, submitted, selected, or imported
something, run it in that event's callback. Do not set a flag and watch the flag
with an effect.

```tsx
const handleSubmit = useCallback(() => {
  createTransaction(formValues, {
    onSuccess: handleSuccess,
    onError: handleError,
  });
}, [createTransaction, formValues, handleError, handleSuccess]);
```

Repository components stay synchronous and use TanStack Query mutation
callbacks rather than `async` component handlers with `mutateAsync`.

### Initial state and reset behavior

Initialize state in `useState`, including a lazy initializer when appropriate.
If the whole component state should reset when an identity changes, prefer a
meaningful React `key` at the ownership boundary. Do not add an effect merely
to copy props into state.

## Server State Belongs in TanStack Query

Manual request effects are a valid low-level React technique, but they are not
the application pattern in this repository. Effects alone do not provide the
cache ownership, request deduplication, retries, invalidation, or race handling
the application needs.

Use TanStack Query hooks for backend and Session Gateway data. For example,
[`useAuth`](../src/features/auth/hooks/useAuth.ts) owns the current-user query,
and [`useTransactions`](../src/hooks/useTransactions.ts) owns transaction
queries. Components consume query state during render and trigger mutations
from event callbacks. See [API integration](api-integration.md) for the client
boundary and [State architecture](state-architecture.md) for state ownership.

## Decision Checklist

Before writing an effect, ask:

1. What external system is being synchronized?
2. What setup must be undone, and does cleanup fully mirror it?
3. Does setup need every reactive value listed as a dependency?
4. Could this instead be calculated during render?
5. Did a user event cause it, making the event handler the correct owner?
6. Is it server state, making a TanStack Query hook the correct owner?

If there is no external system, an effect is usually the wrong abstraction.

## Further Reading

- React: [`useEffect` reference](https://react.dev/reference/react/useEffect)
- React: [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- React: [Lifecycle of Reactive Effects](https://react.dev/learn/lifecycle-of-reactive-effects)
- React: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- React: [Separating Events from Effects](https://react.dev/learn/separating-events-from-effects)
- TanStack Query: [React overview](https://tanstack.com/query/latest/docs/framework/react/overview)
