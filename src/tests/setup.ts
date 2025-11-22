import '@testing-library/jest-dom';
import { server } from '@/tests/mocks/server';
import { beforeAll, afterEach, afterAll } from 'vitest';

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Clean up after all tests
afterAll(() => server.close());
