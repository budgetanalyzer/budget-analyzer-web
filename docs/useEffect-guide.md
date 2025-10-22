# useEffect Guide

A comprehensive guide to understanding and using React's `useEffect` hook.

---

## What is useEffect?

`useEffect` is a React hook that lets you **perform side effects** in function components. A "side effect" is any operation that affects something outside the component's render output.

### Examples of Side Effects:
- Fetching data from an API
- Subscribing to events (window resize, websockets)
- Manually changing the DOM (document.title)
- Setting up timers/intervals
- Syncing state between components

---

## Basic Syntax

```typescript
useEffect(() => {
  // Side effect code goes here

  return () => {
    // Optional cleanup function
  };
}, [dependencies]);
```

---

## The Three Parts

### 1. Effect Function (First Argument)

The code that runs after React renders your component:

```typescript
useEffect(() => {
  console.log('This runs after render');
});
```

### 2. Cleanup Function (Optional Return)

Runs before the effect runs again, or when component unmounts:

```typescript
useEffect(() => {
  const timer = setInterval(() => console.log('tick'), 1000);

  return () => {
    clearInterval(timer); // Cleanup: stop timer
  };
}, []);
```

### 3. Dependency Array (Second Argument)

Controls **when** the effect runs:

| Dependency Array | When Effect Runs |
|-----------------|------------------|
| Not provided: `useEffect(() => {...})` | After **every** render |
| Empty array: `useEffect(() => {...}, [])` | Only **once** after initial render |
| With deps: `useEffect(() => {...}, [a, b])` | After initial render + whenever `a` or `b` change |

---

## Real-World Examples

### Example 1: Data Fetching

```typescript
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => setUser(data));
  }, [userId]); // Re-fetch when userId changes

  return <div>{user?.name}</div>;
}
```

### Example 2: Event Listeners

```typescript
function WindowSize() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);

    window.addEventListener('resize', handleResize);

    // Cleanup: remove listener when component unmounts
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Empty array = setup once, cleanup on unmount

  return <div>Window width: {width}px</div>;
}
```

### Example 3: Document Title

```typescript
function Notifications({ count }) {
  useEffect(() => {
    document.title = `You have ${count} notifications`;
  }, [count]); // Update title when count changes

  return <div>Notifications: {count}</div>;
}
```

### Example 4: Syncing State (From Budget Analyzer)

```typescript
// TransactionTable.tsx
function TransactionTable({ onFilteredRowsChange }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const table = useReactTable({...});

  // Notify parent when filtered data changes
  useEffect(() => {
    if (onFilteredRowsChange) {
      const filteredRows = table.getFilteredRowModel().rows.map(row => row.original);
      onFilteredRowsChange(filteredRows);
    }
  }, [table, onFilteredRowsChange, globalFilter]);
  // ↑ Re-run when filter changes

  return <table>...</table>;
}
```

### Example 5: Timers

```typescript
function Countdown({ seconds }) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    if (timeLeft === 0) return;

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    // Cleanup: clear timer if component unmounts or timeLeft changes
    return () => clearTimeout(timer);
  }, [timeLeft]); // Re-run when timeLeft changes

  return <div>{timeLeft} seconds remaining</div>;
}
```

---

## Mental Model

Think of `useEffect` as saying:

> "After React renders this component, **synchronize** something with the outside world"

Examples:
- **Synchronize** DOM with state (document.title)
- **Synchronize** parent component with child's filtered data
- **Synchronize** component with server data (fetching)
- **Synchronize** component with browser APIs (window events)

---

## Common Pitfalls

### ❌ Pitfall 1: Missing Dependencies

```typescript
function BadExample() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log(count); // Uses 'count' but not in deps
  }, []); // ❌ Will always log stale value (0)!

  return <button onClick={() => setCount(count + 1)}>Increment</button>;
}
```

**Fix:**
```typescript
useEffect(() => {
  console.log(count);
}, [count]); // ✅ Re-runs when count changes
```

### ❌ Pitfall 2: Infinite Loop

```typescript
function BadExample() {
  const [data, setData] = useState([]);

  useEffect(() => {
    setData([...data, 'new']); // ❌ Updates data → triggers effect → updates data → ...
  }, [data]); // Depends on what it modifies!

  return <div>{data.length}</div>;
}
```

**Fix Option 1:** Remove dependency
```typescript
useEffect(() => {
  setData(prevData => [...prevData, 'new']); // ✅ Use functional update
}, []); // Run once
```

**Fix Option 2:** Fetch from external source
```typescript
useEffect(() => {
  fetch('/api/data')
    .then(res => res.json())
    .then(newData => setData(newData)); // ✅ Data comes from outside
}, []); // Run once
```

### ❌ Pitfall 3: Not Cleaning Up

```typescript
function BadExample() {
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('tick');
    }, 1000);
    // ❌ No cleanup! Interval keeps running after unmount
  }, []);

  return <div>Component</div>;
}
```

**Fix:**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    console.log('tick');
  }, 1000);

  return () => clearInterval(interval); // ✅ Cleanup
}, []);
```

### ❌ Pitfall 4: Functions in Dependencies

```typescript
function BadExample() {
  const fetchData = () => {
    // fetch logic
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]); // ❌ fetchData is recreated every render → infinite loop

  return <div>Component</div>;
}
```

**Fix Option 1:** Move function inside effect
```typescript
useEffect(() => {
  const fetchData = () => {
    // fetch logic
  };
  fetchData();
}, []); // ✅ No external dependencies
```

**Fix Option 2:** Use useCallback
```typescript
const fetchData = useCallback(() => {
  // fetch logic
}, []); // Memoized function

useEffect(() => {
  fetchData();
}, [fetchData]); // ✅ fetchData reference is stable
```

---

## When NOT to Use useEffect

### ❌ Don't Use for Calculations

```typescript
// ❌ BAD: Don't use effect for derived state
const [filteredItems, setFilteredItems] = useState([]);

useEffect(() => {
  setFilteredItems(items.filter(i => i.active));
}, [items]);
```

**Use useMemo instead:**
```typescript
// ✅ GOOD: Compute during render
const filteredItems = useMemo(
  () => items.filter(i => i.active),
  [items]
);
```

### ❌ Don't Use for Event Handlers

```typescript
// ❌ BAD: Effect for user interaction
const [buttonClicked, setButtonClicked] = useState(false);

useEffect(() => {
  if (buttonClicked) {
    handleSubmit();
  }
}, [buttonClicked]);

return <button onClick={() => setButtonClicked(true)}>Submit</button>;
```

**Call function directly:**
```typescript
// ✅ GOOD: Handle event directly
return <button onClick={handleSubmit}>Submit</button>;
```

### ❌ Don't Use to Initialize State

```typescript
// ❌ BAD: Effect to set initial state
const [user, setUser] = useState(null);

useEffect(() => {
  setUser(getStoredUser());
}, []);
```

**Initialize directly:**
```typescript
// ✅ GOOD: Initialize with function
const [user, setUser] = useState(() => getStoredUser());
```

---

## Advanced Patterns

### Pattern 1: Conditional Effects

```typescript
useEffect(() => {
  if (!shouldFetch) return; // Early return

  fetch('/api/data')
    .then(res => res.json())
    .then(setData);
}, [shouldFetch]); // Only fetch when shouldFetch is true
```

### Pattern 2: Multiple Effects

```typescript
function Component({ userId, themeId }) {
  // ✅ Split unrelated effects
  useEffect(() => {
    fetchUser(userId);
  }, [userId]);

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  // Better than one effect with both dependencies
}
```

### Pattern 3: Abort Controller (Cancel Requests)

```typescript
useEffect(() => {
  const controller = new AbortController();

  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(setData)
    .catch(err => {
      if (err.name === 'AbortError') {
        console.log('Fetch aborted');
      }
    });

  return () => controller.abort(); // Cancel on unmount or re-run
}, [dependency]);
```

### Pattern 4: Debouncing

```typescript
function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    // Debounce: wait 500ms after user stops typing
    const timer = setTimeout(() => {
      if (query) {
        fetch(`/api/search?q=${query}`)
          .then(res => res.json())
          .then(setResults);
      }
    }, 500);

    return () => clearTimeout(timer); // Cancel previous timer
  }, [query]);

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
    />
  );
}
```

---

## Debugging useEffect

### Log Effect Runs

```typescript
useEffect(() => {
  console.log('Effect ran', { dep1, dep2 });

  // Your effect logic

  return () => {
    console.log('Cleanup ran', { dep1, dep2 });
  };
}, [dep1, dep2]);
```

### Use React DevTools

1. Open React DevTools in browser
2. Select component
3. Look at "Hooks" section
4. See which effects ran and when

### ESLint Rule

Enable the `react-hooks/exhaustive-deps` rule to catch missing dependencies:

```json
// .eslintrc.json
{
  "rules": {
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

---

## Quick Reference

### Common Use Cases

| Use Case | Dependency Array | Cleanup? |
|----------|------------------|----------|
| Fetch data once | `[]` | No |
| Fetch when prop changes | `[propName]` | Maybe (abort controller) |
| Subscribe to events | `[]` | Yes (unsubscribe) |
| Set up timer | `[]` or `[dep]` | Yes (clear timer) |
| Update document title | `[value]` | No |
| Sync with parent | `[value]` | No |

### When to Clean Up

✅ **Always clean up:**
- Event listeners
- Timers (setTimeout, setInterval)
- Subscriptions (websockets, observables)
- Async operations (abort controllers)

❌ **No cleanup needed:**
- Simple state updates
- Logging
- Analytics
- Document title changes

---

## Summary

**useEffect = "Do something after render, optionally when specific values change"**

- **First argument:** What to do (side effect function)
- **Second argument:** When to do it (dependency array)
- **Optional return:** How to clean up

### Key Rules:
1. Include all dependencies the effect uses
2. Clean up side effects that need it
3. Don't use for calculations (use `useMemo`)
4. Don't use for event handlers (call directly)
5. Split unrelated effects into separate `useEffect` calls

---

## Further Reading

- [React useEffect Documentation](https://react.dev/reference/react/useEffect)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Separating Events from Effects](https://react.dev/learn/separating-events-from-effects)
- See also: `docs/state-architecture.md` for how useEffect fits into overall state management