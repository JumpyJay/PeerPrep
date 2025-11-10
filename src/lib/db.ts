import pg, { Pool } from "pg";
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";

let pool: Pool | undefined;
let connector: Connector | undefined;

const ENV = {
  USE_CLOUD_SQL: (process.env.USE_CLOUD_SQL ?? "false").toLowerCase() === "true",
  INSTANCE: process.env.INSTANCE_CONNECTION_NAME, // "PROJECT:REGION:INSTANCE"
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: Number(process.env.DB_PORT ?? 5432),
  DB_USER: process.env.DB_USER ?? "postgres",
  DB_PASS: process.env.DB_PASS ?? "",
  DB_NAME: process.env.DB_NAME ?? "postgres",
  MAX: Number(process.env.DB_POOL_MAX ?? 20),
  IDLE: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
  CONNECT_TIMEOUT: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 5000),
};

export async function getConnectionPool(): Promise<Pool> {
  if (pool) return pool;

  if (ENV.USE_CLOUD_SQL) {
    if (!ENV.INSTANCE) {
      throw new Error('USE_CLOUD_SQL=true but INSTANCE_CONNECTION_NAME is missing (expected "PROJECT:REGION:INSTANCE").');
    }
    if (!connector) connector = new Connector();
    const clientOpts = await connector.getOptions({
      instanceConnectionName: ENV.INSTANCE,
      ipType: IpAddressTypes.PUBLIC,
    });
    pool = new pg.Pool({
      ...clientOpts,
      user: ENV.DB_USER,
      password: ENV.DB_PASS,
      database: ENV.DB_NAME,
      max: ENV.MAX,
      idleTimeoutMillis: ENV.IDLE,
      connectionTimeoutMillis: ENV.CONNECT_TIMEOUT,
    });
  } else {
    // Local (via Cloud SQL Auth Proxy or direct Postgres)
    pool = new pg.Pool({
      host: ENV.DB_HOST,
      port: ENV.DB_PORT,
      user: ENV.DB_USER,
      password: ENV.DB_PASS,
      database: ENV.DB_NAME,
      max: ENV.MAX,
      idleTimeoutMillis: ENV.IDLE,
      connectionTimeoutMillis: ENV.CONNECT_TIMEOUT,
      ssl: false,
    });
  }

  pool.on("error", (err) => console.error("Postgres pool error:", err));
  return pool;
}

process.on("beforeExit", async () => {
  if (pool) await pool.end();
  if (connector) connector.close();
});
