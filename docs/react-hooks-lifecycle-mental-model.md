# React Hooks: Understanding the Lifecycle Mental Model Shift

This document explains the mental model shift from class component lifecycle methods to React hooks, specifically `useState` and `useEffect`.

## The Fundamental Hooks

### `useState` - Managing Component State

`useState` lets you add **state** (data that can change) to functional components.

**Syntax:**
```typescript
const [value, setValue] = useState(initialValue);
```

**Example:**
```typescript
const [globalFilter, setGlobalFilter] = useState('');
const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
```

**What it does:**
1. Returns an array with 2 elements:
   - `globalFilter` - the current state value
   - `setGlobalFilter` - function to update the state
2. When you call `setGlobalFilter('new value')`, React:
   - Updates the state
   - Re-renders the component with the new value

**Simple Example:**
```typescript
function Counter() {
  const [count, setCount] = useState(0);  // Initial value: 0

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

---

### `useEffect` - Side Effects & Lifecycle

`useEffect` lets you perform **side effects** in functional components - things like:
- Fetching data
- Subscribing to events
- Updating the DOM directly
- Setting timers

**Syntax:**
```typescript
useEffect(() => {
  // Code to run (the "effect")

  return () => {
    // Optional cleanup function
  };
}, [dependencies]);
```

**The dependency array controls when the effect runs:**

1. **No array** - Runs after every render
   ```typescript
   useEffect(() => {
     console.log('Runs after every render');
   });
   ```

2. **Empty array `[]`** - Runs only once after initial render (like `componentDidMount`)
   ```typescript
   useEffect(() => {
     console.log('Runs once on mount');
   }, []);
   ```

3. **With dependencies** - Runs when dependencies change
   ```typescript
   useEffect(() => {
     console.log('Runs when count changes');
   }, [count]);
   ```

**Example with Cleanup:**
```typescript
useEffect(() => {
  // Subscribe to something
  const subscription = api.subscribe(data => {
    setData(data);
  });

  // Cleanup function (runs before next effect or on unmount)
  return () => {
    subscription.unsubscribe();
  };
}, []);
```

---

## The Mental Model Shift

### Old Mental Model (Class Components)

You thought in terms of **lifecycle methods**:

```javascript
class UserProfile extends React.Component {
  componentDidMount() {
    // Runs once after first render
    this.fetchUser(this.props.userId);
  }

  componentDidUpdate(prevProps) {
    // Runs after every update
    if (prevProps.userId !== this.props.userId) {
      this.fetchUser(this.props.userId);
    }
  }

  componentWillUnmount() {
    // Cleanup
    this.subscription.unsubscribe();
  }
}
```

You had to think: "What lifecycle am I in?"

---

### New Mental Model (Hooks)

Instead, think about **synchronization** - keeping your component in sync with props/state:

```javascript
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // This effect synchronizes the user data with the userId
    fetchUser(userId).then(setUser);
  }, [userId]); // "Keep this effect in sync with userId"

  return <div>{user?.name}</div>;
}
```

The mental shift: **"What does this effect need to stay synchronized with?"** rather than "What lifecycle phase am I in?"

---

## Mapping Class Lifecycles to `useEffect`

### 1. `componentDidMount` (run once on mount)

**Class:**
```javascript
componentDidMount() {
  console.log('Mounted!');
}
```

**Hooks:**
```javascript
useEffect(() => {
  console.log('Mounted!');
}, []); // Empty array = no dependencies = runs once
```

---

### 2. `componentDidUpdate` (run on specific prop/state changes)

**Class:**
```javascript
componentDidUpdate(prevProps, prevState) {
  if (prevProps.userId !== this.props.userId) {
    this.fetchUser(this.props.userId);
  }
  if (prevState.filter !== this.state.filter) {
    this.applyFilter(this.state.filter);
  }
}
```

**Hooks:**
```javascript
// Separate effects for separate concerns!
useEffect(() => {
  fetchUser(userId);
}, [userId]); // Runs when userId changes

useEffect(() => {
  applyFilter(filter);
}, [filter]); // Runs when filter changes
```

**Key insight:** With hooks, you split by **concern** (what you're synchronizing), not by **lifecycle phase**.

---

### 3. `componentWillUnmount` (cleanup)

**Class:**
```javascript
componentDidMount() {
  this.subscription = api.subscribe(this.handleData);
}

componentWillUnmount() {
  this.subscription.unsubscribe();
}
```

**Hooks:**
```javascript
useEffect(() => {
  const subscription = api.subscribe(handleData);

  // Return a cleanup function
  return () => {
    subscription.unsubscribe();
  };
}, []); // Setup and teardown happen together!
```

**Key insight:** Setup and cleanup are **co-located** in the same effect.

---

### 4. Both `componentDidMount` AND `componentDidUpdate`

**Class:**
```javascript
componentDidMount() {
  document.title = this.props.title;
}

componentDidUpdate(prevProps) {
  if (prevProps.title !== this.props.title) {
    document.title = this.props.title;
  }
}
```

Notice the **duplication**? You had to write the same logic twice!

**Hooks:**
```javascript
useEffect(() => {
  document.title = title;
}, [title]); // Runs on mount AND whenever title changes
```

**Key insight:** `useEffect` runs on mount AND when dependencies change - no duplication needed!

---

## The Real Mental Model Shift

### Old way (lifecycle-based):
- "When does my component mount/update/unmount?"
- Split logic across multiple lifecycle methods
- Easy to forget to update both mount and update

### New way (synchronization-based):
- "What external things does my component need to stay in sync with?"
- Each effect handles ONE concern
- Runs on mount AND updates automatically

---

## Practical Examples

### Example 1: Update Page Title Based on Data

```javascript
export function TransactionsPage() {
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);

  // Effect: Keep document title in sync with transaction count
  useEffect(() => {
    document.title = `Transactions (${filteredTransactions.length})`;

    // Cleanup: restore original title when component unmounts
    return () => {
      document.title = 'Budget Analyzer';
    };
  }, [filteredTransactions.length]); // Re-run when count changes

  // This runs:
  // 1. On mount (initial count)
  // 2. Every time filteredTransactions.length changes
  // 3. Cleanup runs before each new effect and on unmount
}
```

---

### Example 2: Multiple Independent Effects

Instead of one giant `componentDidUpdate` checking everything, split into focused effects:

```javascript
function UserDashboard({ userId, theme }) {
  // Effect 1: Sync user data with userId
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  // Effect 2: Sync theme with localStorage
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.body.className = theme;
  }, [theme]);

  // Effect 3: Setup/teardown analytics
  useEffect(() => {
    analytics.trackPageView();
    return () => analytics.cleanup();
  }, []); // Only on mount/unmount
}
```

Each effect is **independent** and focuses on **one concern**.

---

### Example 3: Fetching Data

**Old way (with duplication):**
```javascript
class UserProfile extends React.Component {
  componentDidMount() {
    this.fetchAndSetUser(this.props.userId);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.userId !== this.props.userId) {
      this.fetchAndSetUser(this.props.userId); // Same logic repeated!
    }
  }

  fetchAndSetUser(userId) {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(user => this.setState({ user }));
  }
}
```

**New way (no duplication):**
```javascript
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(setUser);
  }, [userId]); // Automatically runs on mount AND when userId changes

  return <div>{user?.name}</div>;
}
```

---

## How React Query Simplifies This Further

In this codebase, you rarely see `useEffect` because **React Query handles it for you**!

```javascript
// Instead of manually using useState + useEffect:
function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  // ... render logic
}

// React Query does all of this for you:
function TransactionsPage() {
  const { data: transactions, isLoading, error } = useTransactions();

  // That's it! React Query handles:
  // - useState for data, loading, error
  // - useEffect for fetching
  // - Caching, refetching, and more
}
```

So `useQuery` is essentially a powerful combination of `useState` + `useEffect` + caching logic, which is why the code is so clean!

---

## Key Takeaways

1. **Think synchronization, not lifecycle phases** - "What does this effect need to stay in sync with?"

2. **Split by concern, not by lifecycle** - Multiple small, focused effects instead of one giant lifecycle method

3. **Co-locate setup and cleanup** - They live together in the same `useEffect`

4. **Dependencies are key** - The dependency array tells React when to re-run the effect

5. **No duplication** - `useEffect` automatically runs on mount AND when dependencies change

6. **Custom hooks abstract patterns** - Libraries like React Query encapsulate common `useState` + `useEffect` patterns