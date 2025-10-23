# Budget Analyzer Documentation

Welcome to the Budget Analyzer documentation! This folder contains comprehensive guides to help you understand and work with the codebase.

---

## Available Guides

### 📚 [State Architecture Guide](./state-architecture.md)
Learn how state management works in this application, including:
- React Query for server state (where transactions live)
- Redux Toolkit for UI state (theme, selections)
- Local component state (temporary UI)
- Complete data flow examples
- Best practices and anti-patterns

**Read this if you're wondering:**
- Where are transactions stored?
- Should I use Redux or React Query?
- How does filtering work between components?

---

### ⚡ [useEffect Guide](./useEffect-guide.md)
A comprehensive guide to React's `useEffect` hook, including:
- What useEffect is and how it works
- The three parts: effect function, cleanup, dependencies
- Real-world examples from the codebase
- Common pitfalls and how to avoid them
- When NOT to use useEffect

**Read this if you're wondering:**
- How does useEffect work?
- Why is my effect running too often (or not at all)?
- How do I sync state between components?

---

### 🔄 [React Hooks Lifecycle Mental Model](./react-hooks-lifecycle-mental-model.md)
A guide for transitioning from class components to hooks, including:
- Explanation of `useState` and `useEffect`
- Mental model shift from lifecycle methods to synchronization
- Mapping lifecycle methods to `useEffect` patterns
- Multiple practical examples
- How React Query simplifies common patterns

**Read this if you're wondering:**
- How do I replicate `componentDidMount` with hooks?
- What's the difference between lifecycle thinking and synchronization thinking?
- Why don't I see many `useEffect` calls in this codebase?

---

### 🧪 [Testing Guide](./testing-guide.md)
Complete testing setup and best practices, including:
- Testing stack (Vitest, React Testing Library, MSW)
- How MSW mocks API calls
- Testing components, hooks, and async behavior
- Common patterns and anti-patterns
- Debugging tips

**Read this if you're wondering:**
- How do I run tests?
- How does MSW work?
- How do I test components with API calls?
- What should I test vs. what should I skip?

---

## Quick Start

### For New Developers

1. **Start here:** [State Architecture Guide](./state-architecture.md)
   - Understand where data lives and flows
   - See the big picture of the app

2. **Then read:** [useEffect Guide](./useEffect-guide.md)
   - Master one of React's most important hooks
   - Learn how parent/child components sync

3. **Coming from class components?** [React Hooks Lifecycle Mental Model](./react-hooks-lifecycle-mental-model.md)
   - Understand the mental shift from lifecycle methods to hooks
   - Map `componentDidMount`/`componentDidUpdate` to `useEffect`

4. **Finally:** [Testing Guide](./testing-guide.md)
   - Learn how to write and run tests
   - Understand the MSW setup

### For Specific Questions

| Question | Guide |
|----------|-------|
| Where are transactions stored? | [State Architecture](./state-architecture.md#1-react-query---server-state-where-transactions-live) |
| How does filtering update stats? | [State Architecture](./state-architecture.md#user-types-in-search-box) |
| What is useEffect? | [useEffect Guide](./useEffect-guide.md#what-is-useeffect) |
| How do I replicate componentDidMount? | [React Hooks Lifecycle](./react-hooks-lifecycle-mental-model.md#1-componentdidmount-run-once-on-mount) |
| How do I test components? | [Testing Guide](./testing-guide.md#example-1-simple-component-test) |
| How does MSW work? | [Testing Guide](./testing-guide.md#msw-mock-service-worker) |
| When should I use Redux? | [State Architecture](./state-architecture.md#2-redux---ui-state-only) |

---

## Code Examples

All guides include real examples from this codebase:

### State Management Example
```typescript
// React Query for server data
const { data: transactions } = useTransactions();

// Local state for UI
const [globalFilter, setGlobalFilter] = useState('');

// Redux for global UI preferences
const theme = useAppSelector(state => state.ui.theme);
```

### useEffect Example
```typescript
// Sync filtered data from child to parent
useEffect(() => {
  if (onFilteredRowsChange) {
    const filteredRows = table.getFilteredRowModel().rows;
    onFilteredRowsChange(filteredRows);
  }
}, [globalFilter, transactions]);
```

### Testing Example
```typescript
it('fetches transactions successfully', async () => {
  const { result } = renderHook(() => useTransactions(), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data).toBeDefined();
});
```

---

## Contributing to Documentation

### Adding New Guides

1. Create a new `.md` file in the `docs/` folder
2. Follow the existing format (overview, examples, best practices)
3. Add a link to this README
4. Update the Quick Start section if needed

### Updating Existing Guides

When you make significant code changes:
1. Check if any guides need updates
2. Add new examples if patterns change
3. Keep code examples in sync with actual codebase

### Documentation Style

- ✅ Use real code examples from the project
- ✅ Include both good and bad examples (DO/DON'T)
- ✅ Provide complete, runnable code snippets
- ✅ Add visual diagrams for complex flows
- ✅ Link between related guides
- ❌ Don't use generic/made-up examples
- ❌ Don't assume prior knowledge

---

## External Resources

### React
- [React Documentation](https://react.dev/)
- [React Query (TanStack Query)](https://tanstack.com/query/latest)
- [Redux Toolkit](https://redux-toolkit.js.org/)

### Testing
- [Vitest](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [MSW (Mock Service Worker)](https://mswjs.io/)

### UI Components
- [Shadcn/ui](https://ui.shadcn.com/)
- [TanStack Table](https://tanstack.com/table/latest)
- [Tailwind CSS](https://tailwindcss.com/)

---

## Getting Help

1. **Check these docs first** - Most common questions are answered here
2. **Search the codebase** - Look for similar patterns
3. **Ask the team** - Share which doc you read and what's still unclear
4. **Update the docs** - If you found the answer, add it to help others!

---

## Document Status

| Guide | Last Updated | Status |
|-------|--------------|--------|
| State Architecture | 2025-10-22 | ✅ Complete |
| useEffect Guide | 2025-10-22 | ✅ Complete |
| React Hooks Lifecycle Mental Model | 2025-10-22 | ✅ Complete |
| Testing Guide | 2025-10-22 | ✅ Complete |

---

## Next Steps

📖 **Ready to dive in?** Start with the [State Architecture Guide](./state-architecture.md) to understand the foundation of how this app works!

🧪 **Want to write tests?** Jump to the [Testing Guide](./testing-guide.md) to learn the testing setup.

⚡ **Confused about effects?** Check out the [useEffect Guide](./useEffect-guide.md) for detailed explanations.