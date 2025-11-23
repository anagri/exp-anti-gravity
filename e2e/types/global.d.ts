import { PGlite } from '@electric-sql/pglite';

declare global {
  interface Window {
    dbGlobal?: PGlite;
  }
}

export {};
