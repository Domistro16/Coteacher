import { Pool } from "pg";
import type { SchoolState } from "../packages/shared/src/generated/school-state";
import {
  emptySchoolState,
  restoreSchoolState,
  checkSchoolState,
  type SchoolRepository,
} from "./school-store";

/** One locked aggregate per transaction keeps membership/enrollment approvals atomic.
 * This initial adapter deliberately favors correctness over write throughput.
 */
export class PostgresSchoolRepository implements SchoolRepository {
  private pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 5 });
  }
  async migrate() {
    await this.pool.query(
      "CREATE TABLE IF NOT EXISTS coteacher_school_state (id integer PRIMARY KEY CHECK (id = 1), state jsonb NOT NULL)",
    );
    await this.pool.query("REVOKE ALL ON coteacher_school_state FROM PUBLIC");
    // Supabase can grant default privileges to browser roles independently of PUBLIC.
    await this.pool.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON coteacher_school_state FROM anon; END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON coteacher_school_state FROM authenticated; END IF;
    END $$`);
    await this.pool.query(
      "ALTER TABLE coteacher_school_state ENABLE ROW LEVEL SECURITY",
    );
    await this.pool.query(
      "INSERT INTO coteacher_school_state(id,state) VALUES(1,$1::jsonb) ON CONFLICT DO NOTHING",
      [JSON.stringify(emptySchoolState())],
    );
  }
  async transaction<T>(
    work: (state: SchoolState) => T | Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ state: SchoolState }>(
        "SELECT state FROM coteacher_school_state WHERE id=1 FOR UPDATE",
      );
      if (!result.rows[0])
        throw new Error("Run school database migrations first.");
      const state = restoreSchoolState(result.rows[0].state);
      const output = await work(state);
      checkSchoolState(state);
      await client.query(
        "UPDATE coteacher_school_state SET state=$1::jsonb WHERE id=1",
        [JSON.stringify(state)],
      );
      await client.query("COMMIT");
      return output;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  close() {
    return this.pool.end();
  }
}
