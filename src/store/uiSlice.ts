// src/store/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SortingState } from '@tanstack/react-table';
import { TransactionType } from '@/types/transaction';

interface TransactionTableState {
  sorting: SortingState;
  pageIndex: number;
  pageSize: number;
  globalFilter: string;
  dateFilter: {
    from: string | null;
    to: string | null;
  };
  bankNameFilter: string | null;
  accountIdFilter: string | null;
  typeFilter: TransactionType | null;
  amountFilter: {
    min: number | null;
    max: number | null;
  };
}

interface UiState {
  theme: 'light' | 'dark';
  selectedTransactionId: number | null;
  displayCurrency: string;
  hasNavigated: boolean;
  transactionTable: TransactionTableState;
  selectedViewIds: string[];
}

const initialState: UiState = {
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  selectedTransactionId: null,
  displayCurrency: localStorage.getItem('displayCurrency') || 'USD',
  hasNavigated: false,
  transactionTable: {
    sorting: [{ id: 'date', desc: true }],
    pageIndex: 0,
    pageSize: 10,
    globalFilter: '',
    dateFilter: {
      from: null,
      to: null,
    },
    bankNameFilter: null,
    accountIdFilter: null,
    typeFilter: null,
    amountFilter: {
      min: null,
      max: null,
    },
  },
  selectedViewIds: JSON.parse(localStorage.getItem('selectedViewIds') || '[]'),
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
    setTransactionTableBankNameFilter: (state, action: PayloadAction<string | null>) => {
      state.transactionTable.bankNameFilter = action.payload;
    },
    setTransactionTableAccountIdFilter: (state, action: PayloadAction<string | null>) => {
      state.transactionTable.accountIdFilter = action.payload;
    },
    setTransactionTableTypeFilter: (state, action: PayloadAction<TransactionType | null>) => {
      state.transactionTable.typeFilter = action.payload;
    },
    setTransactionTableAmountFilter: (
      state,
      action: PayloadAction<{ min: number | null; max: number | null }>,
    ) => {
      state.transactionTable.amountFilter = action.payload;
    },
    setHasNavigated: (state, action: PayloadAction<boolean>) => {
      state.hasNavigated = action.payload;
    },
    toggleViewSelection: (state, action: PayloadAction<string>) => {
      const viewId = action.payload;
      const currentSet = new Set(state.selectedViewIds);
      if (currentSet.has(viewId)) {
        currentSet.delete(viewId);
      } else {
        currentSet.add(viewId);
      }
      state.selectedViewIds = Array.from(currentSet);
      localStorage.setItem('selectedViewIds', JSON.stringify(state.selectedViewIds));
    },
    setSelectedViewIds: (state, action: PayloadAction<string[]>) => {
      state.selectedViewIds = action.payload;
      localStorage.setItem('selectedViewIds', JSON.stringify(action.payload));
    },
  },
});

export const {
  toggleTheme,
  setTheme,
  setSelectedTransactionId,
  setDisplayCurrency,
  setHasNavigated,
  setTransactionTableSorting,
  setTransactionTablePageIndex,
  setTransactionTablePageSize,
  setTransactionTableGlobalFilter,
  setTransactionTableDateFilter,
  setTransactionTableBankNameFilter,
  setTransactionTableAccountIdFilter,
  setTransactionTableTypeFilter,
  setTransactionTableAmountFilter,
  toggleViewSelection,
  setSelectedViewIds,
} = uiSlice.actions;
export default uiSlice.reducer;
