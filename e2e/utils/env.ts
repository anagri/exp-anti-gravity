import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { expect } from '@playwright/test';
import { config } from 'dotenv';

export function loadTestApiKey(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const envPath = join(__dirname, '..', '.env.test');

  if (existsSync(envPath)) {
    config({ path: envPath, quiet: true });
  }

  const apiKey = process.env.TEST_OPENAI_API_KEY;
  expect(
    apiKey,
    'TEST_OPENAI_API_KEY not found in e2e/.env.test or environment variables'
  ).toBeDefined();

  return apiKey!;
}
