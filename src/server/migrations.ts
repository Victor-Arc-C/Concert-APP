import { migrations } from './schema';

export interface MigrationDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string): Promise<void>;
}

// Run once before replicas start. Each migration and its version commit together.
export async function migrate(db: MigrationDatabase) {
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY)');
  for (const migration of migrations) {
    if (
      !(
        await db.query('SELECT version FROM schema_migrations WHERE version=$1', [
          migration.version,
        ])
      ).length
    ) {
      await db.execute(
        `BEGIN; ${migration.sql} INSERT INTO schema_migrations(version) VALUES (${migration.version}); COMMIT;`,
      );
    }
  }
}
