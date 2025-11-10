import pg, { Pool } from "pg";
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";

// define global cache for the database connection pool.
let pool: Pool | undefined;
let connector: Connector | undefined;

/**
 * create and return a connection pool to the database.
 * if cached exists, it returns that
 */
export async function getConnectionPool(): Promise<Pool> {
  // If the pool already exists and has been initialized, return it.
  if (pool) {
    return pool;
  }

  // initialize the Cloud SQL Connector
  if (!connector) {
    connector = new Connector();
  }

  // configure the database connection options
  const clientOpts = await connector.getOptions({
    instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME!,
    // instance IP address type of 'peerprep33' instance is public
    ipType: IpAddressTypes.PUBLIC,
  });

  // create new connection pool
  const maxConnections = Number(process.env.DB_POOL_MAX ?? 20);
  const idleTimeoutMillis = Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30_000);
  const connectionTimeoutMillis = Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 5_000);

  const newPool = new pg.Pool({
    ...clientOpts,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    max: maxConnections,
    idleTimeoutMillis,
    connectionTimeoutMillis,
  });

  newPool.on("error", (err) => {
    console.error("Postgres pool error:", err);
  });

  // cache the new pool for future requests.
  pool = newPool;
  return pool;
}

// clean up function
process.on("beforeExit", async () => {
  if (pool) {
    await pool.end();
  }
  if (connector) {
    connector.close();
  }
});
