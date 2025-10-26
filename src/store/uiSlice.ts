// src/store/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SortingState } from '@tanstack/react-table';

interface TransactionTableState {
  sorting: SortingState;
  pageIndex: number;
  pageSize: number;
  globalFilter: string;
  dateFilter: {
    from: string | null;
    to: string | null;
  };
}

interface UiState {
  theme: 'light' | 'dark';
  selectedTransactionId: number | null;
  displayCurrency: string;
  transactionTable: TransactionTableState;
}

const initialState: UiState = {
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  selectedTransactionId: null,
  displayCurrency: localStorage.getItem('displayCurrency') || 'USD',
  transactionTable: {
    sorting: [{ id: 'date', desc: true }],
    pageIndex: 0,
    pageSize: 10,
    globalFilter: '',
    dateFilter: {
      from: null,
      to: null,
    },
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', state.theme);
      document.documentElement.classList.toggle('dark', state.theme === 'dark');
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      localStorage.setItem('theme', state.theme);
      document.documentElement.classList.toggle('dark', state.theme === 'dark');
    },
    setSelectedTransactionId: (state, action: PayloadAction<number | null>) => {
      state.selectedTransactionId = action.payload;
    },
    setDisplayCurrency: (state, action: PayloadAction<string>) => {
      state.displayCurrency = action.payload;
      localStorage.setItem('displayCurrency', action.payload);
    },
    setTransactionTableSorting: (state, action: PayloadAction<SortingState>) => {
      state.transactionTable.sorting = action.payload;
    },
    setTransactionTablePageIndex: (state, action: PayloadAction<number>) => {
      state.transactionTable.pageIndex = action.payload;
    },
    setTransactionTablePageSize: (state, action: PayloadAction<number>) => {
      state.transactionTable.pageSize = action.payload;
    },
    setTransactionTableGlobalFilter: (state, action: PayloadAction<string>) => {
      state.transactionTable.globalFilter = action.payload;
    },
    setTransactionTableDateFilter: (
      state,
      action: PayloadAction<{ from: string | null; to: string | null }>,
    ) => {
      state.transactionTable.dateFilter = action.payload;
    },
  },
});

export const {
  toggleTheme,
  setTheme,
  setSelectedTransactionId,
  setDisplayCurrency,
  setTransactionTableSorting,
  setTransactionTablePageIndex,
  setTransactionTablePageSize,
  setTransactionTableGlobalFilter,
  setTransactionTableDateFilter,
} = uiSlice.actions;
export default uiSlice.reducer;
