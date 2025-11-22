import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export function loadTestApiKey(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const envPath = join(__dirname, '..', '.env.test');

  if (existsSync(envPath)) {
    config({ path: envPath, quiet: true });
  }

  const apiKey = process.env.TEST_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('TEST_OPENAI_API_KEY not found in e2e/.env.test or environment variables');
  }

  return apiKey;
}
