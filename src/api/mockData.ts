// src/api/mockData.ts
import { Transaction } from '@/types/transaction';
import { CurrencySeriesResponse, ExchangeRateResponse } from '@/types/currency';

export const mockCurrencies: CurrencySeriesResponse[] = [
  {
    id: 1,
    currencyCode: 'USD',
    providerSeriesId: 'USD',
    enabled: true,
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 2,
    currencyCode: 'THB',
    providerSeriesId: 'DEXTHUS',
    enabled: true,
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-01-15T10:30:00Z',
  },
];

export const mockExchangeRates: ExchangeRateResponse[] = [
  {
    baseCurrency: 'USD',
    targetCurrency: 'THB',
    date: '2025-10-10',
    rate: 33.5,
    publishedDate: '2025-10-10',
  },
  {
    baseCurrency: 'USD',
    targetCurrency: 'THB',
    date: '2025-10-11',
    rate: 33.48,
    publishedDate: '2025-10-11',
  },
  {
    baseCurrency: 'USD',
    targetCurrency: 'THB',
    date: '2025-10-12',
    rate: 33.52,
    publishedDate: '2025-10-12',
  },
  {
    baseCurrency: 'USD',
    targetCurrency: 'THB',
    date: '2025-10-13',
    rate: 33.45,
    publishedDate: '2025-10-13',
  },
  {
    baseCurrency: 'USD',
    targetCurrency: 'THB',
    date: '2025-10-14',
    rate: 33.51,
    publishedDate: '2025-10-14',
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
