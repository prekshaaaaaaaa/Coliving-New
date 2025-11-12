const express = require("express");
const pool = require("../db");
const router = express.Router();

// Create or get a chat room between two users
router.post('/rooms/get-or-create', async (req, res) => {
  try {
    console.log('[chatRoutes] POST /rooms/get-or-create body:', req.body);
    const { userId, otherUserId, otherIdentifier } = req.body;
    if (!userId || (!otherUserId && !otherIdentifier)) return res.status(400).json({ success: false, error: 'userId and otherUserId/otherIdentifier required' });

    // Detect whether users.firebase_uid column exists to avoid SQL errors on older schemas
    let hasFirebaseUid = false;
    try {
      const col = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='firebase_uid' LIMIT 1");
      hasFirebaseUid = col.rows.length > 0;
    } catch (e) {
      console.warn('Could not detect firebase_uid column:', e.message || e);
      hasFirebaseUid = false;
    }

    // Helper: resolve an identifier (numeric id, email, or firebase_uid) to numeric user_id
    // This mirrors the robust resolver used in matchRoutes: try numeric, email, firebase_uid (if present),
    // and as a last resort attempt to create a minimal placeholder users row (dev convenience).
      // Helper: robust resolver copied from matchRoutes.js
      async function resolveUserIdParam(param) {
        if (param === undefined || param === null || param === '') return null;
      // Normalize identifier: decode URL-encoded values and trim whitespace
      try {
        if (typeof param === 'string') param = decodeURIComponent(param).trim();
      } catch (e) {
        param = String(param).trim();
      }

      // numeric user_id
      const numeric = Number(param);
      if (Number.isInteger(numeric)) {
        const r = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [numeric]);
        if (r.rows.length > 0) return r.rows[0].user_id;
      }

      // email
      if (typeof param === 'string' && param.includes('@')) {
        const r = await pool.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [param]);
        if (r.rows.length > 0) return r.rows[0].user_id;
      }

      // firebase_uid column fallback if present
      try {
        const colCheck = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='firebase_uid' LIMIT 1");
        if (colCheck.rows.length > 0 && typeof param === 'string') {
          const r = await pool.query('SELECT user_id FROM users WHERE firebase_uid = $1 LIMIT 1', [param]);
          if (r.rows.length > 0) return r.rows[0].user_id;
        }
      } catch (e) {
        // ignore
      }

      // If still not found, as a development convenience attempt to create a minimal users row
      // NOTE: This will create a placeholder user with a fake aadhar_no to satisfy NOT NULL constraints.
      if (typeof param === 'string') {
        try {
          const placeholderAadhar = ("P" + Date.now()).slice(-12).padStart(12, "0");
          const placeholderPassword = `p_${Date.now()}`;

          // Inspect available columns to choose insertion strategy
          const colsQ = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users'");
          const existingCols = colsQ.rows.map(r => r.column_name);

          let insertSql = null;
          let values = [];

          if (param.includes('@') && existingCols.includes('email')) {
            // Create user with email. Use ON CONFLICT to avoid race duplicate key errors.
            insertSql = "INSERT INTO users (name, email, password, aadhar_no) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING user_id";
            values = [param.split('@')[0] || 'Pending User', param, placeholderPassword, placeholderAadhar];
          } else if (existingCols.includes('firebase_uid')) {
            // Create user with firebase_uid. Use ON CONFLICT on firebase_uid if present.
            insertSql = "INSERT INTO users (name, firebase_uid, password, aadhar_no) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING user_id";
            values = [param.slice(0, 20) || 'Pending User', param, placeholderPassword, placeholderAadhar];
          } else if (existingCols.includes('email')) {
            // Email column exists but param isn't an email; generate a fake email to satisfy NOT NULL constraint
            const fakeEmail = `pending_${Date.now()}@example.invalid`;
            insertSql = "INSERT INTO users (name, email, password, aadhar_no) VALUES ($1,$2,$3,$4) RETURNING user_id";
            values = [param.slice(0, 20) || 'Pending User', fakeEmail, placeholderPassword, placeholderAadhar];
          } else {
            // Generic insert (no email/firebase_uid available) - fallback to simple insert
            insertSql = "INSERT INTO users (name, password, aadhar_no) VALUES ($1,$2,$3) RETURNING user_id";
            values = [param.slice(0, 20) || 'Pending User', placeholderPassword, placeholderAadhar];
          }

          const created = await pool.query(insertSql, values);
          if (created.rows.length > 0) {
            console.warn(`[chatRoutes] Auto-created placeholder user ${created.rows[0].user_id} for identifier ${param}`);
            return created.rows[0].user_id;
          }

          // If INSERT returned no rows (ON CONFLICT DO NOTHING), try to lookup the existing row
          try {
            if (param.includes('@') && existingCols.includes('email')) {
              const found = await pool.query("SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [param]);
              if (found.rows.length > 0) return found.rows[0].user_id;
            }
            if (existingCols.includes('firebase_uid')) {
              const found = await pool.query("SELECT user_id FROM users WHERE firebase_uid = $1 LIMIT 1", [param]);
              if (found.rows.length > 0) return found.rows[0].user_id;
            }
          } catch (e) {
            // ignore lookup error
          }
        } catch (createErr) {
          // If insert failed (constraint/unique), attempt to find again to avoid race issues
          console.error('[chatRoutes] Auto-create user failed:', createErr.message || createErr);
          try {
            const retryEmail = await pool.query("SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [param]);
            if (retryEmail.rows.length > 0) return retryEmail.rows[0].user_id;
          } catch (retryErr) {
            // ignore
          }
          try {
            const colCheck = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='firebase_uid' LIMIT 1");
            if (colCheck.rows.length > 0) {
              const retryUid = await pool.query("SELECT user_id FROM users WHERE firebase_uid = $1 LIMIT 1", [param]);
              if (retryUid.rows.length > 0) return retryUid.rows[0].user_id;
            }
          } catch (retryErr2) {
            // ignore
          }
        }
      }

      return null;
    };

  const numericA = await resolveUserIdParam(userId);
  const numericB = await resolveUserIdParam(otherUserId || otherIdentifier);
    if (!Number.isInteger(numericA) || !Number.isInteger(numericB)) {
      return res.status(400).json({ success: false, error: 'Could not resolve userId and otherUserId to numeric user ids' });
    }

    // Ensure both users exist (redundant after resolve but keep for clarity)
    const usersRes = await pool.query('SELECT user_id FROM users WHERE user_id = ANY($1::int[])', [[numericA, numericB]]);
    if (usersRes.rows.length < 2) return res.status(404).json({ success: false, error: 'One or both users not found' });

  // Always store with smaller id first to avoid duplicates
  const [u1, u2] = numericA < numericB ? [numericA, numericB] : [numericB, numericA];

    // Try find existing room
    const existing = await pool.query('SELECT * FROM chat_rooms WHERE user1_id = $1 AND user2_id = $2', [u1, u2]);
    if (existing.rows.length > 0) {
      console.log('[chatRoutes] found existing room', existing.rows[0].chat_room_id);
      return res.json({ success: true, chatRoomId: existing.rows[0].chat_room_id });
    }

    // Create new room
    const insert = await pool.query('INSERT INTO chat_rooms (user1_id, user2_id, created_at) VALUES ($1, $2, NOW()) RETURNING chat_room_id, user1_id, user2_id, created_at', [u1, u2]);
    const room = insert.rows[0];

  console.log('[chatRoutes] created room', room.chat_room_id);
  // Optionally notify via sockets if available
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`chat_${room.chat_room_id}`).emit('room_created', { roomId: room.chat_room_id, users: [room.user1_id, room.user2_id] });
      }
    } catch (e) {
      console.warn('Failed to emit room_created', e.message || e);
    }

    return res.json({ success: true, chatRoomId: room.chat_room_id });
  } catch (err) {
    console.error('Error in get-or-create room:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Get all chat rooms for a user
router.get("/rooms/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const numericUserId = Number(userId);
    if (!Number.isInteger(numericUserId)) return res.status(400).json({ success: false, error: 'userId must be numeric' });

    // Check chat tables exist
    const chatTables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('chat_rooms', 'messages')`
    );
    if (chatTables.rows.length < 2) {
      return res.status(501).json({ success: false, error: 'Chat endpoints are not available: chat tables (chat_rooms/messages) are missing. Run migrations to add them.' });
    }

    // Ensure user exists
    const userCheck = await pool.query('SELECT user_id, name, email FROM users WHERE user_id = $1', [numericUserId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });

    // Get all chat rooms where user is either user1 or user2
    const roomsResult = await pool.query(
      `SELECT cr.chat_room_id, cr.user1_id, cr.user2_id, cr.created_at,
        u1.name AS user1_name, u2.name AS user2_name,
        CASE WHEN cr.user1_id = $1 THEN u2.name ELSE u1.name END AS other_user_name,
        CASE WHEN cr.user1_id = $1 THEN cr.user2_id ELSE cr.user1_id END AS other_user_id
      FROM chat_rooms cr
      JOIN users u1 ON cr.user1_id = u1.user_id
      JOIN users u2 ON cr.user2_id = u2.user_id
      WHERE cr.user1_id = $1 OR cr.user2_id = $1
      ORDER BY cr.created_at DESC`,
      [numericUserId]
    );

    res.json({ success: true, rooms: roomsResult.rows });
  } catch (err) {
    console.error("Error fetching chat rooms:", err);
    res.status(500).json({ success: false, error: err.message || "Server error fetching chat rooms" });
  }
});

// Get messages for a chat room
router.get("/messages/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.query; // Verify user has access to this room

    // Verify chat tables exist before proceeding
    const chatTables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('chat_rooms', 'messages')`
    );
    if (chatTables.rows.length < 2) {
      return res.status(501).json({ success: false, error: 'Chat endpoints are not available: chat tables (chat_rooms/messages) are missing. Run migrations to add them.' });
    }

    const numericRoomId = Number(roomId);
    const numericUserId = Number(userId);
    if (!Number.isInteger(numericRoomId) || !Number.isInteger(numericUserId)) {
      return res.status(400).json({ success: false, error: 'roomId and userId must be numeric' });
    }

    // Verify user has access to this chat room
    const roomCheck = await pool.query(
      "SELECT * FROM chat_rooms WHERE chat_room_id = $1 AND (user1_id = $2 OR user2_id = $2)",
      [numericRoomId, numericUserId]
    );

    if (roomCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: "Access denied to this chat room" });
    }

    // Get messages
    const messagesResult = await pool.query(
      `SELECT m.message_id, m.sender_id, m.message_text, m.created_at, u.name AS sender_name
       FROM messages m
       JOIN users u ON m.sender_id = u.user_id
       WHERE m.chat_room_id = $1
       ORDER BY m.created_at ASC`,
      [numericRoomId]
    );

    res.json({ success: true, messages: messagesResult.rows });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Server error fetching messages",
    });
  }
});

// Send a message
router.post("/messages", async (req, res) => {
  try {
    const { roomId, userId, messageText } = req.body;

    if (!roomId || !userId || !messageText) {
      return res.status(400).json({
        success: false,
        error: "Missing roomId, userId, or messageText",
      });
    }

    // Verify chat tables exist before proceeding
    const chatTables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('chat_rooms', 'messages')`
    );
    if (chatTables.rows.length < 2) {
      return res.status(501).json({ success: false, error: 'Chat endpoints are not available: chat tables (chat_rooms/messages) are missing. Run migrations to add them.' });
    }

    const numericRoomId = Number(roomId);
    const numericUserId = Number(userId);
    if (!Number.isInteger(numericRoomId) || !Number.isInteger(numericUserId)) {
      return res.status(400).json({ success: false, error: 'roomId and userId must be numeric' });
    }

    // Verify user has access to this chat room
    const roomCheck = await pool.query(
      "SELECT * FROM chat_rooms WHERE chat_room_id = $1 AND (user1_id = $2 OR user2_id = $2)",
      [numericRoomId, numericUserId]
    );

    if (roomCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: "Access denied to this chat room" });
    }

    // Insert message
    const messageResult = await pool.query(
      `INSERT INTO messages (chat_room_id, sender_id, message_text, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING message_id, sender_id, message_text, created_at`,
      [numericRoomId, numericUserId, messageText]
    );

    const inserted = messageResult.rows[0];

    // Attempt to broadcast the new message via Socket.IO if available
    try {
      const io = req.app.get('io');
      if (io) {
        // Include sender name in the payload
        const senderNameRes = await pool.query('SELECT name FROM users WHERE user_id = $1', [numericUserId]);
        const senderName = senderNameRes.rows[0]?.name || null;
        const payload = {
          message_id: inserted.message_id,
          sender_id: inserted.sender_id,
          message_text: inserted.message_text,
          created_at: inserted.created_at,
          sender_name: senderName,
        };
        io.to(`chat_${numericRoomId}`).emit('new_message', { roomId: numericRoomId, message: payload });
      }
    } catch (e) {
      console.warn('Failed to emit socket message:', e.message || e);
    }

    res.json({ success: true, message: inserted });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Server error sending message",
    });
  }
});

module.exports = router;

