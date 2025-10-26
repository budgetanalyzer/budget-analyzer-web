// src/api/mockData.ts
import { Transaction } from '@/types/transaction';
import { CurrencyCode, ExchangeRateResponse, Currency } from '@/types/currency';

export const mockCurrencies: CurrencyCode[] = ['USD', 'THB'];

const mockUSD: Currency = {
  currencyCode: 'USD',
  displayName: 'US Dollar',
  symbol: '$',
  defaultFractionDigits: 2,
  numericCode: 840,
  numericCodeAsString: '840',
};

const mockTHB: Currency = {
  currencyCode: 'THB',
  displayName: 'Thai Baht',
  symbol: '฿',
  defaultFractionDigits: 2,
  numericCode: 764,
  numericCodeAsString: '764',
};

export const mockExchangeRates: ExchangeRateResponse[] = [
  {
    baseCurrency: mockUSD,
    targetCurrency: mockTHB,
    date: '2025-10-10',
    rate: 33.5,
  },
  {
    baseCurrency: mockUSD,
    targetCurrency: mockTHB,
    date: '2025-10-11',
    rate: 33.48,
  },
  {
    baseCurrency: mockUSD,
    targetCurrency: mockTHB,
    date: '2025-10-12',
    rate: 33.52,
  },
  {
    baseCurrency: mockUSD,
    targetCurrency: mockTHB,
    date: '2025-10-13',
    rate: 33.45,
  },
  {
    baseCurrency: mockUSD,
    targetCurrency: mockTHB,
    date: '2025-10-14',
    rate: 33.51,
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: 1,
    accountId: 'checking-3223',
    bankName: 'Capital One',
    date: '2025-10-14',
    currencyIsoCode: 'USD',
    amount: -52.34,
    type: 'DEBIT',
    description: 'Whole Foods Market',
    createdAt: '2025-10-14T12:34:56Z',
    updatedAt: '2025-10-14T12:34:56Z',
  },
  {
    id: 2,
    accountId: 'checking-3223',
    bankName: 'Capital One',
    date: '2025-10-13',
    currencyIsoCode: 'USD',
    amount: -89.99,
    type: 'DEBIT',
    description: 'Amazon.com',
    createdAt: '2025-10-13T09:22:11Z',
    updatedAt: '2025-10-13T09:22:11Z',
  },
  {
    id: 3,
    accountId: 'savings-4556',
    bankName: 'Chase',
    date: '2025-10-12',
    currencyIsoCode: 'USD',
    amount: 2500.0,
    type: 'CREDIT',
    description: 'Payroll Deposit',
    createdAt: '2025-10-12T08:00:00Z',
    updatedAt: '2025-10-12T08:00:00Z',
  },
  {
    id: 4,
    accountId: 'checking-3223',
    bankName: 'Capital One',
    date: '2025-10-11',
    currencyIsoCode: 'USD',
    amount: -1200.0,
    type: 'DEBIT',
    description: 'Rent Payment',
    createdAt: '2025-10-11T15:30:00Z',
    updatedAt: '2025-10-11T15:30:00Z',
  },
  {
    id: 5,
    accountId: 'checking-3223',
    bankName: 'Capital One',
    date: '2025-10-10',
    currencyIsoCode: 'USD',
    amount: -45.67,
    type: 'DEBIT',
    description: 'Shell Gas Station',
    createdAt: '2025-10-10T17:45:22Z',
    updatedAt: '2025-10-10T17:45:22Z',
  },
];
