const express = require('express');
const pool = require('../db');
const router = express.Router();

// Returns presence/absence of optional columns/tables to help debug schema
router.get('/schema-health', async (req, res) => {
  try {
    const checkColumn = async (table, column) => {
      const q = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
        [table, column]
      );
      return q.rows.length > 0;
    };

    const checkTable = async (table) => {
      const q = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1`,
        [table]
      );
      return q.rows.length > 0;
    };

    const report = {
      tables: {
        users: await checkTable('users'),
        residents: await checkTable('residents'),
        roommates: await checkTable('roommates'),
        user_selections: await checkTable('user_selections'),
        matches: await checkTable('matches'),
        chat_rooms: await checkTable('chat_rooms'),
      },
      columns: {
        users_firebase_uid: await checkColumn('users', 'firebase_uid'),
        residents_preferences: await checkColumn('residents', 'preferences'),
        roommates_preferences: await checkColumn('roommates', 'preferences'),
      },
    };

    res.json({ success: true, report });
  } catch (err) {
    console.error('Error in schema-health:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a minimal users row for testing. Will insert only columns that exist.
// Expected body: any of { name, email, password, phone, aadhar_no, aadhar_image_url, user_type }
router.post('/create-user', async (req, res) => {
  try {
    const payload = req.body || {};

    // Inspect which columns exist in users
    const colsQ = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`);
    const existingCols = colsQ.rows.map(r => r.column_name);

    // If aadhar_no is present in schema and it's NOT NULL in your DDL, require it in payload
    const aadharCol = existingCols.includes('aadhar_no');
    if (aadharCol && !payload.aadhar_no) {
      return res.status(400).json({ success: false, error: 'This DB requires aadhar_no for users. Provide aadhar_no in the request body to create a test user.' });
    }

    const allowed = ['name', 'email', 'password', 'phone', 'aadhar_no', 'aadhar_image_url', 'user_type'];
    const insertCols = [];
    const values = [];
    const placeholders = [];

    for (const col of allowed) {
      if (existingCols.includes(col) && payload[col] !== undefined) {
        insertCols.push(col);
        values.push(payload[col]);
        placeholders.push(`$${values.length}`);
      }
    }

    if (insertCols.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid user columns present in payload to insert.' });
    }

    const sql = `INSERT INTO users (${insertCols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING user_id`;
    const result = await pool.query(sql, values);
    res.json({ success: true, user_id: result.rows[0].user_id });
  } catch (err) {
    console.error('Error creating test user:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

// GET /api/debug/user-info/:identifier
// identifier can be numeric user_id, email, or firebase_uid (if present)
router.get('/user-info/:identifier', async (req, res) => {
  try {
    let { identifier } = req.params;
    if (!identifier) return res.status(400).json({ success: false, error: 'Missing identifier' });

    // Normalize identifier
    try {
      identifier = decodeURIComponent(identifier).trim();
    } catch (e) {
      identifier = String(identifier).trim();
    }
    console.log('[debugRoutes] user-info requested for identifier:', identifier);

    // Try numeric
    const num = Number(identifier);
    if (Number.isInteger(num)) {
      const q = await pool.query('SELECT user_id, name, email, user_type FROM users WHERE user_id = $1', [num]);
      if (q.rows.length > 0) return res.json({ success: true, user: q.rows[0] });
    }

    // Try email (case-insensitive)
    if (identifier.includes('@')) {
      const q = await pool.query('SELECT user_id, name, email, user_type, aadhar_no, aadhar_image_url, aadhar_verified FROM users WHERE LOWER(email) = LOWER($1)', [identifier]);
      if (q.rows.length > 0) return res.json({ success: true, user: q.rows[0] });
    }

    // Try firebase_uid if column exists
    try {
      const col = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='firebase_uid' LIMIT 1");
      if (col.rows.length > 0) {
        const q = await pool.query('SELECT user_id, name, email, user_type FROM users WHERE firebase_uid = $1', [identifier]);
        if (q.rows.length > 0) return res.json({ success: true, user: q.rows[0] });
      }
    } catch (e) {
      // ignore
    }

    return res.status(404).json({ success: false, error: 'User not found' });
  } catch (err) {
    console.error('Error in user-info:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DEV helper: list users (first 200 rows) - useful for debugging 'User not found'
// WARNING: Dev-only endpoint; remove or protect in production.
router.get('/list-users', async (req, res) => {
  try {
    const q = await pool.query('SELECT user_id, name, email, aadhar_no FROM users ORDER BY user_id DESC LIMIT 200');
    return res.json({ success: true, count: q.rows.length, users: q.rows });
  } catch (err) {
    console.error('Error in list-users:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

