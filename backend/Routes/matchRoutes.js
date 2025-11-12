const express = require("express");
const pool = require("../db");
const router = express.Router();

// Helper: resolve a user identifier which may be numeric user_id, email, or firebase_uid
async function resolveUserIdParam(param) {
  if (param === undefined || param === null || param === '') return null;

  // Normalize identifier: decode URL-encoded values and trim whitespace
  try {
    if (typeof param === 'string') param = decodeURIComponent(param).trim();
  } catch (e) {
    // ignore decode errors and fallback to original
    param = String(param).trim();
  }

  // numeric user_id
  const numeric = Number(param);
  if (Number.isInteger(numeric)) {
    const r = await pool.query("SELECT user_id FROM users WHERE user_id = $1", [numeric]);
    if (r.rows.length > 0) return r.rows[0].user_id;
  }

  // email
  if (typeof param === 'string' && param.includes('@')) {
    const r = await pool.query("SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)", [param]);
    if (r.rows.length > 0) return r.rows[0].user_id;
  }

  // firebase_uid column fallback if present

  // firebase_uid column fallback if present
  try {
    const colCheck = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='firebase_uid' LIMIT 1");
    if (colCheck.rows.length > 0 && typeof param === 'string') {
      const r = await pool.query("SELECT user_id FROM users WHERE firebase_uid = $1", [param]);
      if (r.rows.length > 0) return r.rows[0].user_id;
    }
  } catch (e) {
    // ignore and continue
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
      } else {
        // Generic insert (no email/firebase_uid available) - fallback to simple insert
        insertSql = "INSERT INTO users (name, password, aadhar_no) VALUES ($1,$2,$3) RETURNING user_id";
        values = [param.slice(0, 20) || 'Pending User', placeholderPassword, placeholderAadhar];
      }

      const created = await pool.query(insertSql, values);
      if (created.rows.length > 0) {
        console.warn(`[matchRoutes] Auto-created placeholder user ${created.rows[0].user_id} for identifier ${param}`);
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
        // ignore lookup error and continue to outer catch which will try a generic retry
      }
    } catch (createErr) {
      // If insert failed (constraint/unique), attempt to find again to avoid race issues
      console.error('[matchRoutes] Auto-create user failed:', createErr.message || createErr);
      try {
        // try case-insensitive email
        const retryEmail = await pool.query("SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [param]);
        if (retryEmail.rows.length > 0) return retryEmail.rows[0].user_id;
      } catch (retryErr) {
        // ignore
      }
      try {
        // try firebase_uid
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
}

// Get matches for a roommate (use matches table + residents join)
router.get("/roommate-matches/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user_id = await resolveUserIdParam(userId);
    if (!user_id) return res.status(404).json({ success: false, error: "User not found" });

    // Get roommate_id for this user
    const rr = await pool.query("SELECT roommate_id FROM roommates WHERE user_id = $1", [user_id]);
    if (rr.rows.length === 0) {
      return res.json({ success: true, matches: [], message: "No roommate profile found" });
    }
    const roommate_id = rr.rows[0].roommate_id;

    // Get pending matches for this roommate (join resident + user info)
    const q = `SELECT m.match_id, m.compatibility_score, m.status, m.matched_on,
      r.resident_id, r.user_id as resident_user_id, u.name as resident_name, u.email as resident_email,
      r.property_location, r.rent, r.description, r.religious_pref, r.roommate_food_pref,
      r.smokes, r.roommate_smokes_ok, r.roommate_age_pref, r.roommate_gender_pref,
      r.environment_pref, r.curfew_time, r.works, r.roommate_night_ok, r.profession,
      r.relationship_status, r.roommate_pets_ok, r.extra_requirements
      FROM matches m
      JOIN residents r ON m.resident_id = r.resident_id
      JOIN users u ON r.user_id = u.user_id
      WHERE m.roommate_id = $1 AND m.status = 'pending'
      ORDER BY m.compatibility_score DESC`;

    const result = await pool.query(q, [roommate_id]);

    // If no matches exist for this roommate, try to generate compatibility matches (safe, idempotent)
    if (result.rows.length === 0) {
      try {
        const insertSql = `
          INSERT INTO matches (resident_id, roommate_id, compatibility_score, status)
          SELECT r.resident_id, rm.roommate_id,
            (
              (CASE WHEN LOWER(r.property_location) = LOWER(rm.current_location) THEN 20 ELSE 0 END) +
              (CASE WHEN r.roommate_food_pref = rm.food_type THEN 15 ELSE 0 END) +
              (CASE WHEN r.roommate_smokes_ok = TRUE OR rm.smokes = FALSE THEN 10 ELSE 0 END) +
              (CASE WHEN r.roommate_drinks_ok = TRUE OR rm.drinks = FALSE THEN 10 ELSE 0 END) +
              (CASE WHEN r.cleanliness = rm.cleanliness THEN 10 ELSE 0 END) +
              (CASE WHEN r.roommate_gender_pref = rm.roommate_gender_pref THEN 10 ELSE 0 END) +
              (CASE WHEN r.roommate_pets_ok = TRUE OR rm.owns_pets = FALSE THEN 10 ELSE 0 END) +
              (CASE WHEN r.profession = rm.profession OR rm.profession_pref = 'flexible' THEN 10 ELSE 0 END) +
              (CASE WHEN r.environment_pref = rm.environment_pref THEN 5 ELSE 0 END)
            ) AS compatibility_score,
            'pending'
          FROM residents r
          JOIN roommates rm ON rm.roommate_id = $1
          WHERE rm.user_id != r.user_id
            AND NOT EXISTS (
              SELECT 1 FROM matches m WHERE m.resident_id = r.resident_id AND m.roommate_id = rm.roommate_id
            );
        `;
        await pool.query(insertSql, [roommate_id]);
      } catch (genErr) {
        console.error('Error generating matches for roommate:', genErr);
      }

      // re-query after generation
      const retry = await pool.query(q, [roommate_id]);
      return res.json({ success: true, matches: retry.rows.map(row => ({
        matchId: row.match_id,
        compatibilityScore: row.compatibility_score,
        status: row.status,
        matchedOn: row.matched_on,
        id: row.resident_id,
        userId: row.resident_user_id,
        name: row.resident_name,
        email: row.resident_email,
        preferences: {
          propertyLocation: row.property_location,
          maxRent: row.rent,
          description: row.description,
          religiousPref: row.religious_pref,
          roommateFoodPref: row.roommate_food_pref,
          smokes: row.smokes,
          roommateSmokesOk: row.roommate_smokes_ok,
          roommateAgePref: row.roommate_age_pref,
          roommateGenderPref: row.roommate_gender_pref,
          environmentPref: row.environment_pref,
          curfewTime: row.curfew_time,
          works: row.works,
          roommateNightOk: row.roommate_night_ok,
          profession: row.profession,
          relationshipStatus: row.relationship_status,
          roommatePetsOk: row.roommate_pets_ok,
          extraRequirements: row.extra_requirements,
        },
        type: 'resident'
      })) });
    }

    const matches = result.rows.map(row => ({
      matchId: row.match_id,
      compatibilityScore: row.compatibility_score,
      status: row.status,
      matchedOn: row.matched_on,
      id: row.resident_id,
      userId: row.resident_user_id,
      name: row.resident_name,
      email: row.resident_email,
      preferences: {
        propertyLocation: row.property_location,
        maxRent: row.rent,
        description: row.description,
        religiousPref: row.religious_pref,
        roommateFoodPref: row.roommate_food_pref,
        smokes: row.smokes,
        roommateSmokesOk: row.roommate_smokes_ok,
        roommateAgePref: row.roommate_age_pref,
        roommateGenderPref: row.roommate_gender_pref,
        environmentPref: row.environment_pref,
        curfewTime: row.curfew_time,
        works: row.works,
        roommateNightOk: row.roommate_night_ok,
        profession: row.profession,
        relationshipStatus: row.relationship_status,
        roommatePetsOk: row.roommate_pets_ok,
        extraRequirements: row.extra_requirements,
      },
      type: 'resident'
    }));

    res.json({ success: true, matches });
  } catch (err) {
    console.error("Error fetching roommate matches:", err);
    res.status(500).json({ success: false, error: err.message || "Server error fetching matches" });
  }
});

// Get matches for a resident (use matches table + roommates join)
router.get("/resident-matches/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user_id = await resolveUserIdParam(userId);
    if (!user_id) return res.status(404).json({ success: false, error: "User not found" });

    const rr = await pool.query("SELECT resident_id FROM residents WHERE user_id = $1", [user_id]);
    if (rr.rows.length === 0) {
      return res.json({ success: true, matches: [], message: "No resident profile found" });
    }
    const resident_id = rr.rows[0].resident_id;

    const q = `SELECT m.match_id, m.compatibility_score, m.status, m.matched_on,
      rm.roommate_id, rm.user_id as roommate_user_id, u.name as roommate_name, u.email as roommate_email,
      rm.current_location, rm.cultural_pref, rm.food_type, rm.smokes, rm.drinks, rm.dietary_restrictions,
      rm.roommate_smokes_ok, rm.roommate_drinks_ok, rm.roommate_age_pref, rm.roommate_gender_pref,
      rm.environment_pref, rm.curfew_time, rm.owns_pets, rm.pet_details, rm.profession, rm.work_study_schedule,
      rm.roommate_night_ok, rm.relationship_status, rm.profession_pref, rm.cleanliness, rm.cooking_pref, rm.extra_expectations
      FROM matches m
      JOIN roommates rm ON m.roommate_id = rm.roommate_id
      JOIN users u ON rm.user_id = u.user_id
      WHERE m.resident_id = $1 AND m.status = 'pending'
      ORDER BY m.compatibility_score DESC`;

    const result = await pool.query(q, [resident_id]);

    // If no matches exist for this resident, try to generate compatibility matches (safe, idempotent)
    if (result.rows.length === 0) {
      try {
        const insertSql = `
          INSERT INTO matches (resident_id, roommate_id, compatibility_score, status)
          SELECT r.resident_id, rm.roommate_id,
            (
              (CASE WHEN LOWER(r.property_location) = LOWER(rm.current_location) THEN 20 ELSE 0 END) +
              (CASE WHEN r.roommate_food_pref = rm.food_type THEN 15 ELSE 0 END) +
              (CASE WHEN r.roommate_smokes_ok = TRUE OR rm.smokes = FALSE THEN 10 ELSE 0 END) +
              (CASE WHEN r.roommate_drinks_ok = TRUE OR rm.drinks = FALSE THEN 10 ELSE 0 END) +
              (CASE WHEN r.cleanliness = rm.cleanliness THEN 10 ELSE 0 END) +
              (CASE WHEN r.roommate_gender_pref = rm.roommate_gender_pref THEN 10 ELSE 0 END) +
              (CASE WHEN r.roommate_pets_ok = TRUE OR rm.owns_pets = FALSE THEN 10 ELSE 0 END) +
              (CASE WHEN r.profession = rm.profession OR rm.profession_pref = 'flexible' THEN 10 ELSE 0 END) +
              (CASE WHEN r.environment_pref = rm.environment_pref THEN 5 ELSE 0 END)
            ) AS compatibility_score,
            'pending'
          FROM residents r
          JOIN roommates rm ON rm.user_id != r.user_id
          WHERE r.resident_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM matches m WHERE m.resident_id = r.resident_id AND m.roommate_id = rm.roommate_id
            );
        `;
        await pool.query(insertSql, [resident_id]);
      } catch (genErr) {
        console.error('Error generating matches for resident:', genErr);
      }

      // re-query after generation
      const retry = await pool.query(q, [resident_id]);
      return res.json({ success: true, matches: retry.rows.map(row => ({
        matchId: row.match_id,
        compatibilityScore: row.compatibility_score,
        status: row.status,
        matchedOn: row.matched_on,
        id: row.roommate_id,
        userId: row.roommate_user_id,
        name: row.roommate_name,
        email: row.roommate_email,
        preferences: {
          currentLocation: row.current_location,
          culturalPref: row.cultural_pref,
          foodType: row.food_type,
          smokes: row.smokes,
          drinks: row.drinks,
          dietaryRestrictions: row.dietary_restrictions,
          roommateSmokesOk: row.roommate_smokes_ok,
          roommateDrinksOk: row.roommate_drinks_ok,
          roommateAgePref: row.roommate_age_pref,
          roommateGenderPref: row.roommate_gender_pref,
          environmentPref: row.environment_pref,
          curfewTime: row.curfew_time,
          ownsPets: row.owns_pets,
          petDetails: row.pet_details,
          profession: row.profession,
          schedule: row.work_study_schedule,
          roommateNightOk: row.roommate_night_ok,
          relationshipStatus: row.relationship_status,
          professionPref: row.profession_pref,
          cleanliness: row.cleanliness,
          cookingPref: row.cooking_pref,
          extraExpectations: row.extra_expectations,
        },
        type: 'roommate'
      })) });
    }
    const matches = result.rows.map(row => ({
      matchId: row.match_id,
      compatibilityScore: row.compatibility_score,
      status: row.status,
      matchedOn: row.matched_on,
      id: row.roommate_id,
      userId: row.roommate_user_id,
      name: row.roommate_name,
      email: row.roommate_email,
      preferences: {
        currentLocation: row.current_location,
        culturalPref: row.cultural_pref,
        foodType: row.food_type,
        smokes: row.smokes,
        drinks: row.drinks,
        dietaryRestrictions: row.dietary_restrictions,
        roommateSmokesOk: row.roommate_smokes_ok,
        roommateDrinksOk: row.roommate_drinks_ok,
        roommateAgePref: row.roommate_age_pref,
        roommateGenderPref: row.roommate_gender_pref,
        environmentPref: row.environment_pref,
        curfewTime: row.curfew_time,
        ownsPets: row.owns_pets,
        petDetails: row.pet_details,
        profession: row.profession,
        schedule: row.work_study_schedule,
        roommateNightOk: row.roommate_night_ok,
        relationshipStatus: row.relationship_status,
        professionPref: row.profession_pref,
        cleanliness: row.cleanliness,
        cookingPref: row.cooking_pref,
        extraExpectations: row.extra_expectations,
      },
      type: 'roommate'
    }));

    res.json({ success: true, matches });
  } catch (err) {
    console.error("Error fetching resident matches:", err);
    res.status(500).json({ success: false, error: err.message || "Server error fetching matches" });
  }
});
router.post("/action", async (req, res) => {
  try {
    const { userId, matchId, action } = req.body; // matchId should be match_id from matches table

    if (!userId || !matchId || !action) {
      return res.status(400).json({ success: false, error: "Missing userId, matchId, or action" });
    }

    const numericUserId = Number(userId);
    const numericMatchId = Number(matchId);
    if (!Number.isInteger(numericUserId) || !Number.isInteger(numericMatchId)) {
      return res.status(400).json({ success: false, error: "userId and matchId must be numeric" });
    }

    // Ensure the match exists and that the user is part of it
    const matchRow = await pool.query(
      `SELECT m.match_id, m.resident_id, m.roommate_id, r.user_id AS resident_user_id, rm.user_id AS roommate_user_id
       FROM matches m
       LEFT JOIN residents r ON m.resident_id = r.resident_id
       LEFT JOIN roommates rm ON m.roommate_id = rm.roommate_id
       WHERE m.match_id = $1`,
      [numericMatchId]
    );
    if (matchRow.rows.length === 0) return res.status(404).json({ success: false, error: "Match not found" });

    const mr = matchRow.rows[0];
    const participantUserIds = [mr.resident_user_id, mr.roommate_user_id].filter(Boolean);
    if (!participantUserIds.includes(numericUserId)) {
      return res.status(403).json({ success: false, error: "User not a participant in this match" });
    }

    if (action === "accept") {
      await pool.query(`UPDATE matches SET status = 'accepted', matched_on = NOW() WHERE match_id = $1`, [numericMatchId]);
      return res.json({ success: true, message: "Match accepted", isMatch: true, matchId: numericMatchId });
    }

    if (action === "reject") {
      await pool.query(`UPDATE matches SET status = 'rejected' WHERE match_id = $1`, [numericMatchId]);
      return res.json({ success: true, message: "Match rejected", isMatch: false });
    }

    return res.status(400).json({ success: false, error: "Invalid action. Must be 'accept' or 'reject'" });
  } catch (err) {
    console.error("Error handling match action:", err);
    res.status(500).json({ success: false, error: err.message || "Server error handling match action" });
  }
});

// Get mutual matches for a user (both sides accepted)
router.get("/mutual-matches/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user_id = await resolveUserIdParam(userId);
    if (!user_id) return res.status(404).json({ success: false, error: "User not found" });

    // Return accepted matches where the user is either resident or roommate
    const sql = `SELECT m.match_id, m.matched_on, m.status,
      r.resident_id, r.user_id AS resident_user_id, u1.name AS resident_name, u1.email AS resident_email,
      rm.roommate_id, rm.user_id AS roommate_user_id, u2.name AS roommate_name, u2.email AS roommate_email
      FROM matches m
      JOIN residents r ON m.resident_id = r.resident_id
      JOIN roommates rm ON m.roommate_id = rm.roommate_id
      JOIN users u1 ON r.user_id = u1.user_id
      JOIN users u2 ON rm.user_id = u2.user_id
      WHERE (r.user_id = $1 OR rm.user_id = $1) AND m.status = 'accepted'
      ORDER BY m.matched_on DESC`;

    const matchesResult = await pool.query(sql, [user_id]);

    const matches = matchesResult.rows.map(row => {
      const other = row.resident_user_id === user_id
        ? { userId: row.roommate_user_id, name: row.roommate_name, email: row.roommate_email, type: 'roommate', id: row.roommate_id }
        : { userId: row.resident_user_id, name: row.resident_name, email: row.resident_email, type: 'resident', id: row.resident_id };

      return {
        matchId: row.match_id,
        matchedOn: row.matched_on,
        status: row.status,
        other,
      };
    });

    res.json({ success: true, matches });
  } catch (err) {
    console.error("Error fetching mutual matches:", err);
    res.status(500).json({ success: false, error: err.message || "Server error fetching mutual matches" });
  }
});

// Get all matches (for admin/viewing all matches)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.match_id,
        m.compatibility_score,
        m.status,
        m.matched_on,
        r.resident_id,
        rm.roommate_id,
        u1.name AS resident_name,
        u2.name AS roommate_name
      FROM matches m
      JOIN residents r ON m.resident_id = r.resident_id
      JOIN roommates rm ON m.roommate_id = rm.roommate_id
      JOIN users u1 ON r.user_id = u1.user_id
      JOIN users u2 ON rm.user_id = u2.user_id
      ORDER BY m.compatibility_score DESC;
    `);

    res.json({
      success: true,
      matches: result.rows,
    });
  } catch (err) {
    console.error("Error fetching matches:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Server error fetching matches",
    });
  }
});

module.exports = router;
