import { QueryClient, QueryClientProvider, type QueryClientConfig } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter as CoreMemoryRouter } from 'react-router';
import { MemoryRouter as DomMemoryRouter } from 'react-router-dom';
import uiReducer from '@/store/uiSlice';
import type { RootState } from '@/store';

export function createTestQueryClient(config: QueryClientConfig = {}) {
  const defaultOptions: QueryClientConfig['defaultOptions'] = {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  };

  return new QueryClient({
    ...config,
    defaultOptions: {
      ...defaultOptions,
      ...config.defaultOptions,
      queries: {
        ...defaultOptions.queries,
        ...config.defaultOptions?.queries,
      },
      mutations: {
        ...defaultOptions.mutations,
        ...config.defaultOptions?.mutations,
      },
    },
  });
}

export function createTestStore(preloadedState?: RootState) {
  return configureStore({
    reducer: {
      ui: uiReducer,
    },
    preloadedState,
  });
}

export type TestStore = ReturnType<typeof createTestStore>;

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  preloadedState?: RootState;
  queryClient?: QueryClient;
  router?: 'core' | 'dom';
  store?: TestStore;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    initialEntries,
    preloadedState,
    queryClient = createTestQueryClient(),
    router = 'core',
    store = createTestStore(preloadedState),
    ...renderOptions
  }: RenderWithProvidersOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    const providers = (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </Provider>
    );

    if (initialEntries) {
      const MemoryRouter = router === 'dom' ? DomMemoryRouter : CoreMemoryRouter;

      return <MemoryRouter initialEntries={initialEntries}>{providers}</MemoryRouter>;
    }

    return providers;
  }

  return {
    queryClient,
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}
