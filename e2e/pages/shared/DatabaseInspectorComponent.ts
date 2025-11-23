import { Page, expect } from '@playwright/test';

export class DatabaseInspectorComponent {
  constructor(private readonly page: Page) {}

  async isDbGlobalAvailable(): Promise<boolean> {
    return await this.page.evaluate(() => {
      return !!window.dbGlobal;
    });
  }

  async getAllTables(): Promise<string[]> {
    return await this.page.evaluate(async () => {
      if (!window.dbGlobal) {
        console.log('[DBInspector] window.dbGlobal is not available');
        return [];
      }

      try {
        const result = await window.dbGlobal.query(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public'
           ORDER BY table_name`
        );
        console.log(
          '[DBInspector] Found tables:',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result.rows.map((r: any) => r.table_name)
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return result.rows.map((r: any) => r.table_name);
      } catch (error) {
        console.log('[DBInspector] Error querying tables:', error);
        return [];
      }
    });
  }

  async tableExists(tableName: string): Promise<boolean> {
    return await this.page.evaluate(async (name) => {
      if (!window.dbGlobal) return false;

      const result = await window.dbGlobal.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [name]
      );
      return result.rows.length > 0;
    }, tableName);
  }

  async expectTableExists(tableName: string) {
    const dbAvailable = await this.isDbGlobalAvailable();
    if (!dbAvailable) {
      throw new Error('window.dbGlobal is not available - database not exposed to browser context');
    }

    const allTables = await this.getAllTables();
    const exists = await this.tableExists(tableName);

    if (!exists) {
      console.log(`[DBInspector] Table "${tableName}" not found. Available tables:`, allTables);
    }

    expect(
      exists,
      `Table ${tableName} should exist. Available tables: ${allTables.join(', ')}`
    ).toBe(true);
  }

  async expectTableNotExists(tableName: string) {
    const exists = await this.tableExists(tableName);
    expect(exists, `Table ${tableName} should not exist`).toBe(false);
  }

  async getChunkCount(kbId: string): Promise<number> {
    return await this.page.evaluate(async (id) => {
      if (!window.dbGlobal) return 0;

      const tableName = `kb_${id.replace(/-/g, '_')}_chunks`;
      try {
        const result = await window.dbGlobal.query(
          `SELECT COUNT(*)::integer as count FROM ${tableName}`
        );
        return result.rows[0]?.count || 0;
      } catch {
        return 0;
      }
    }, kbId);
  }

  async expectChunkCount(kbId: string, expectedCount: number) {
    const count = await this.getChunkCount(kbId);
    expect(count, `KB ${kbId} should have ${expectedCount} chunks`).toBe(expectedCount);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getTableSchema(tableName: string): Promise<any[]> {
    return await this.page.evaluate(async (name) => {
      if (!window.dbGlobal) return [];

      const result = await window.dbGlobal.query(
        `SELECT column_name, data_type, udt_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [name]
      );
      return result.rows;
    }, tableName);
  }

  async getKBChunksTableName(kbId: string): string {
    return `kb_${kbId.replace(/-/g, '_')}_chunks`;
  }

  async expectEmbeddingDimension(kbId: string, expectedDimension: number) {
    const tableName = await this.getKBChunksTableName(kbId);
    const dimension = await this.page.evaluate(async (name) => {
      if (!window.dbGlobal) return null;

      const result = await window.dbGlobal.query(
        `SELECT atttypmod
           FROM pg_attribute
           JOIN pg_class ON pg_attribute.attrelid = pg_class.oid
           WHERE pg_class.relname = $1 AND pg_attribute.attname = 'embedding'`,
        [name]
      );
      return result.rows[0]?.atttypmod || null;
    }, tableName);

    expect(dimension, `Embedding dimension for KB ${kbId} should be ${expectedDimension}`).toBe(
      expectedDimension
    );
  }
}
