// src/test/setup.ts
import { expect, beforeAll, afterEach, afterAll } from 'vitest';
import '@testing-library/jest-dom';
import * as matchers from '@testing-library/jest-dom/matchers';
import { server } from '@/mocks/server';

expect.extend(matchers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
