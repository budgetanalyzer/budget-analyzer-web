// src/store/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  theme: 'light' | 'dark';
  displayCurrency: string;
  adminSidebarOpen: boolean;
}

const initialState: UiState = {
  theme:
    (localStorage.getItem('theme') as 'light' | 'dark') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  displayCurrency: localStorage.getItem('displayCurrency') || 'USD',
  adminSidebarOpen:
    localStorage.getItem('adminSidebarOpen') === null
      ? true
      : localStorage.getItem('adminSidebarOpen') === 'true',
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
    toggleAdminSidebar: (state) => {
      state.adminSidebarOpen = !state.adminSidebarOpen;
      localStorage.setItem('adminSidebarOpen', String(state.adminSidebarOpen));
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      localStorage.setItem('theme', state.theme);
      document.documentElement.classList.toggle('dark', state.theme === 'dark');
    },
    setDisplayCurrency: (state, action: PayloadAction<string>) => {
      state.displayCurrency = action.payload;
      localStorage.setItem('displayCurrency', action.payload);
    },
  },
});

export const { toggleTheme, setTheme, setDisplayCurrency, toggleAdminSidebar } = uiSlice.actions;
export default uiSlice.reducer;
