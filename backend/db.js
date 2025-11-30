// backend/db.js
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.PGUSER || "postgres",
  host: process.env.PGHOST || "0.tcp.in.ngrok.io",
  database: process.env.PGDATABASE || "coliving_spaces",
  password: process.env.PGPASSWORD || "Diti@1972",
  port: Number(process.env.PGPORT) || 19042,
});

pool.on("error", (err, client) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

(async function startupCheck() {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      console.log("Connected to PostgreSQL");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(
      "PostgreSQL connection failed:",
      err && err.message ? err.message : err
    );
  }
})();

module.exports = pool;
