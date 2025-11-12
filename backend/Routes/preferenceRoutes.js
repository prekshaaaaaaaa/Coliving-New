const express = require("express");
const pool = require("../db");
const router = express.Router();

// Helper to resolve user id (numeric id, email, or firebase_uid)
async function resolveUserId(identifier) {
  if (identifier === undefined || identifier === null || identifier === '') return null;

  // Normalize input
  try {
    if (typeof identifier === 'string') identifier = decodeURIComponent(identifier).trim();
  } catch (e) {
    identifier = String(identifier).trim();
  }

  const num = Number(identifier);
  if (Number.isInteger(num)) {
    const r = await pool.query("SELECT user_id FROM users WHERE user_id = $1", [num]);
    if (r.rows.length > 0) return r.rows[0].user_id;
  }
  if (typeof identifier === 'string' && identifier.includes('@')) {
    const r = await pool.query("SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)", [identifier]);
    if (r.rows.length > 0) return r.rows[0].user_id;
  }
  try {
    const col = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='firebase_uid' LIMIT 1");
    if (col.rows.length > 0 && typeof identifier === 'string') {
      const r = await pool.query("SELECT user_id FROM users WHERE firebase_uid = $1", [identifier]);
      if (r.rows.length > 0) return r.rows[0].user_id;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

const normalize = (val, allowed, fallback = null) => {
  if (val === undefined || val === null) return fallback;
  const s = String(val).trim().toLowerCase();
  for (const a of allowed) if (s === a.toLowerCase()) return a.toLowerCase();
  return fallback;
};

router.post('/save-roommate-preferences', async (req, res) => {
  try {
    const { userId, preferences } = req.body;
    if (!userId || !preferences) return res.status(400).json({ success: false, error: 'Missing userId or preferences' });


    let numericUserId = await resolveUserId(userId);
    // If not found, allow creating placeholder users for both email and firebase uid strings
    if (!numericUserId && typeof userId === 'string') {
      const placeholderAadhar = ("P" + Date.now()).slice(-12).padStart(12, "0");
      const placeholderPassword = `p_${Date.now()}`;
      try {
        const colsQ = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users'");
        const existingCols = colsQ.rows.map(r => r.column_name);

        let insertSql = null;
        let values = [];
        if (userId.includes('@') && existingCols.includes('email')) {
          insertSql = "INSERT INTO users (name,email,password,aadhar_no) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING user_id";
          values = [preferences?.name || 'Pending User', userId, placeholderPassword, placeholderAadhar];
        } else if (existingCols.includes('firebase_uid')) {
          insertSql = "INSERT INTO users (name,firebase_uid,password,aadhar_no) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING user_id";
          values = [preferences?.name || 'Pending User', userId, placeholderPassword, placeholderAadhar];
        } else {
          insertSql = "INSERT INTO users (name,password,aadhar_no) VALUES ($1,$2,$3) RETURNING user_id";
          values = [preferences?.name || 'Pending User', placeholderPassword, placeholderAadhar];
        }

        const insert = await pool.query(insertSql, values);
        if (insert.rows.length > 0) {
          numericUserId = insert.rows[0].user_id;
          console.warn(`Created placeholder user ${numericUserId} for identifier ${userId}`);
        } else {
          // INSERT returned nothing (likely due to ON CONFLICT DO NOTHING) - try to find the existing user
          try {
            if (userId.includes('@') && existingCols.includes('email')) {
              const found = await pool.query("SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [userId]);
              if (found.rows.length > 0) numericUserId = found.rows[0].user_id;
            }
            if (!numericUserId && existingCols.includes('firebase_uid')) {
              const found = await pool.query("SELECT user_id FROM users WHERE firebase_uid = $1 LIMIT 1", [userId]);
              if (found.rows.length > 0) numericUserId = found.rows[0].user_id;
            }
          } catch (e) {
            // ignore and fall through to error below if still not found
          }
        }
      } catch (createErr) {
        console.error('Failed to auto-create user for preferences:', createErr && createErr.message ? createErr.message : createErr);
        // Attempt to recover by searching existing rows
        try {
          const retry = await pool.query("SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [userId]);
          if (retry.rows.length > 0) numericUserId = retry.rows[0].user_id;
        } catch (retryErr) {
          // try firebase uid
          try {
            const col = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='firebase_uid' LIMIT 1");
            if (col.rows.length > 0) {
              const retry2 = await pool.query("SELECT user_id FROM users WHERE firebase_uid = $1 LIMIT 1", [userId]);
              if (retry2.rows.length > 0) numericUserId = retry2.rows[0].user_id;
            }
          } catch (retryErr2) {
            // ignore
          }
        }

        if (!numericUserId) return res.status(500).json({ success: false, error: 'Failed to create user automatically.' });
      }
    }

    if (!numericUserId) return res.status(404).json({ success: false, error: 'User not found' });

    const data = {
      current_location: preferences.currentLocation || null,
      cultural_pref: preferences.religiousPreferences || null,
      food_type: normalize(preferences.dietaryPreference, ['vegetarian','non-vegetarian','vegan','other'], null),
      smokes: typeof preferences.smokes === 'boolean' ? preferences.smokes : (preferences.smokes === 'Yes'),
      drinks: typeof preferences.drinks === 'boolean' ? preferences.drinks : (preferences.drinks === 'Yes'),
      dietary_restrictions: preferences.dietaryRestrictions || null,
      roommate_smokes_ok: typeof preferences.comfortableWithSmokingOrDrinking === 'boolean' ? preferences.comfortableWithSmokingOrDrinking : (preferences.comfortableWithSmokingOrDrinking === 'Yes'),
      roommate_drinks_ok: typeof preferences.comfortableWithSmokingOrDrinking === 'boolean' ? preferences.comfortableWithSmokingOrDrinking : (preferences.comfortableWithSmokingOrDrinking === 'Yes'),
      roommate_age_pref: preferences.ageGroupPreference || null,
      roommate_gender_pref: preferences.genderPreference || null,
      environment_pref: normalize(preferences.environmentPreference, ['quiet','social','party-friendly','no preference'], null),
      curfew_time: preferences.curfewTimings || null,
      owns_pets: preferences.pets ? true : false,
      pet_details: preferences.pets || null,
      profession: preferences.profession || null,
      work_study_schedule: normalize(preferences.schedule, ['day shift','night shift','flexible'], null),
      roommate_night_ok: typeof preferences.okayWithIrregularSchedule === 'boolean' ? preferences.okayWithIrregularSchedule : (preferences.okayWithIrregularSchedule === 'Yes'),
      relationship_status: normalize(preferences.relationshipStatus, ['single','married','relationship'], null),
      profession_pref: normalize(preferences.backgroundPreference, ['student','professional','flexible'], null),
      cleanliness: normalize(preferences.cleanlinessHabits, ['messy','moderate','neat'], null),
      cooking_pref: normalize(preferences.cookingPreference, ['home','outside','no preference'], null),
      extra_expectations: preferences.extraExpectations || null,
    };

    const keys = Object.keys(data);
    const values = Object.values(data);

    const exists = await pool.query('SELECT roommate_id FROM roommates WHERE user_id = $1', [numericUserId]);
    if (exists.rows.length > 0) {
      const setClause = keys.map((k,i) => `${k} = $${i+1}`).join(', ');
      await pool.query(`UPDATE roommates SET ${setClause} WHERE user_id = $${keys.length+1}`, [...values, numericUserId]);
    } else {
      const placeholders = keys.map((_,i) => `$${i+2}`).join(', ');
      await pool.query(`INSERT INTO roommates (user_id, ${keys.join(',')}) VALUES ($1, ${placeholders})`, [numericUserId, ...values]);
    }

    return res.json({ success: true, userId: numericUserId });
  } catch (err) {
    console.error('DB Error (save-roommate-preferences):', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.post('/save-resident-preferences', async (req, res) => {
  try {
    const { userId, preferences } = req.body;
    if (!userId || !preferences) return res.status(400).json({ success: false, error: 'Missing userId or preferences' });


    let numericUserId = await resolveUserId(userId);
    if (!numericUserId && typeof userId === 'string') {
      const placeholderAadhar = ("P" + Date.now()).slice(-12).padStart(12, "0");
      const placeholderPassword = `p_${Date.now()}`;
      try {
        const colsQ = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users'");
        const existingCols = colsQ.rows.map(r => r.column_name);

        let insertSql = null;
        let values = [];
        if (userId.includes('@') && existingCols.includes('email')) {
          insertSql = "INSERT INTO users (name,email,password,aadhar_no) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING user_id";
          values = [preferences?.name || 'Pending User', userId, placeholderPassword, placeholderAadhar];
        } else if (existingCols.includes('firebase_uid')) {
          insertSql = "INSERT INTO users (name,firebase_uid,password,aadhar_no) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING user_id";
          values = [preferences?.name || 'Pending User', userId, placeholderPassword, placeholderAadhar];
        } else {
          insertSql = "INSERT INTO users (name,password,aadhar_no) VALUES ($1,$2,$3) RETURNING user_id";
          values = [preferences?.name || 'Pending User', placeholderPassword, placeholderAadhar];
        }

        const insert = await pool.query(insertSql, values);
        if (insert.rows.length > 0) {
          numericUserId = insert.rows[0].user_id;
          console.warn(`Created placeholder user ${numericUserId} for identifier ${userId}`);
        } else {
          try {
            if (userId.includes('@') && existingCols.includes('email')) {
              const found = await pool.query("SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [userId]);
              if (found.rows.length > 0) numericUserId = found.rows[0].user_id;
            }
            if (!numericUserId && existingCols.includes('firebase_uid')) {
              const found = await pool.query("SELECT user_id FROM users WHERE firebase_uid = $1 LIMIT 1", [userId]);
              if (found.rows.length > 0) numericUserId = found.rows[0].user_id;
            }
          } catch (e) {
            // ignore
          }
        }
      } catch (createErr) {
        console.error('Failed to auto-create user for resident preferences:', createErr && createErr.message ? createErr.message : createErr);
        try {
          const retry = await pool.query("SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [userId]);
          if (retry.rows.length > 0) numericUserId = retry.rows[0].user_id;
        } catch (retryErr) {
          try {
            const col = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='firebase_uid' LIMIT 1");
            if (col.rows.length > 0) {
              const retry2 = await pool.query("SELECT user_id FROM users WHERE firebase_uid = $1 LIMIT 1", [userId]);
              if (retry2.rows.length > 0) numericUserId = retry2.rows[0].user_id;
            }
          } catch (retryErr2) {
            // ignore
          }
        }

        if (!numericUserId) return res.status(500).json({ success: false, error: 'Failed to create user automatically.' });
      }
    }

    if (!numericUserId) return res.status(404).json({ success: false, error: 'User not found' });

    const data = {
      property_location: preferences.propertyLocation || null,
      rent: preferences.rent || null,
      description: preferences.description || null,
      religious_pref: preferences.religiousPref || null,
      roommate_food_pref: normalize(preferences.roommateFoodPref, ['vegetarian','non-vegetarian','vegan','flexible'], null),
      smokes: typeof preferences.smokes === 'boolean' ? preferences.smokes : (preferences.smokes === 'Yes'),
      roommate_smokes_ok: typeof preferences.roommateSmokesOk === 'boolean' ? preferences.roommateSmokesOk : (preferences.roommateSmokesOk === 'Yes'),
      roommate_age_pref: preferences.roommateAgePref || null,
      roommate_gender_pref: preferences.roommateGenderPref || null,
      environment_pref: normalize(preferences.environmentPref, ['quiet','social','party-friendly','no preference'], null),
      curfew_time: preferences.curfewTime || null,
      works: typeof preferences.works === 'boolean' ? preferences.works : null,
      roommate_night_ok: typeof preferences.roommateNightOk === 'boolean' ? preferences.roommateNightOk : (preferences.roommateNightOk === 'Yes'),
      profession: preferences.profession || null,
      relationship_status: normalize(preferences.relationshipStatus, ['single','married','relationship'], null),
      roommate_pets_ok: typeof preferences.roommatePetsOk === 'boolean' ? preferences.roommatePetsOk : (preferences.roommatePetsOk === 'Yes'),
      extra_requirements: preferences.extraRequirements || null,
      drinks: typeof preferences.drinks === 'boolean' ? preferences.drinks : (preferences.drinks === 'Yes'),
      roommate_drinks_ok: typeof preferences.roommateDrinksOk === 'boolean' ? preferences.roommateDrinksOk : (preferences.roommateDrinksOk === 'Yes'),
      cleanliness: normalize(preferences.cleanliness, ['neat','moderate','messy'], null),
      roommate_cooking_pref: normalize(preferences.roommateCookingPref, ['home','outside','no preference'], null),
      roommate_guests_ok: typeof preferences.roommateGuestsOk === 'boolean' ? preferences.roommateGuestsOk : (preferences.roommateGuestsOk === 'Yes'),
    };

    const keys = Object.keys(data);
    const values = Object.values(data);

    const exists = await pool.query('SELECT resident_id FROM residents WHERE user_id = $1', [numericUserId]);
    if (exists.rows.length > 0) {
      const setClause = keys.map((k,i) => `${k} = $${i+1}`).join(', ');
      await pool.query(`UPDATE residents SET ${setClause} WHERE user_id = $${keys.length+1}`, [...values, numericUserId]);
    } else {
      const placeholders = keys.map((_,i) => `$${i+2}`).join(', ');
      await pool.query(`INSERT INTO residents (user_id, ${keys.join(',')}) VALUES ($1, ${placeholders})`, [numericUserId, ...values]);
    }

    return res.json({ success: true, userId: numericUserId });
  } catch (err) {
    console.error('DB Error (save-resident-preferences):', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// GET roommate preferences by identifier (user_id, email, or firebase_uid)
router.get('/get-roommate-preferences/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const numericUserId = await resolveUserId(identifier);
    if (!numericUserId) return res.status(404).json({ success: false, error: 'User not found' });
    const q = await pool.query('SELECT * FROM roommates WHERE user_id = $1', [numericUserId]);
    if (q.rows.length === 0) return res.status(404).json({ success: false, error: 'No roommate preferences found' });
    return res.json({ success: true, preferences: q.rows[0] });
  } catch (err) {
    console.error('Error getting roommate preferences:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// GET resident preferences by identifier
router.get('/get-resident-preferences/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const numericUserId = await resolveUserId(identifier);
    if (!numericUserId) return res.status(404).json({ success: false, error: 'User not found' });
    const q = await pool.query('SELECT * FROM residents WHERE user_id = $1', [numericUserId]);
    if (q.rows.length === 0) return res.status(404).json({ success: false, error: 'No resident preferences found' });
    return res.json({ success: true, preferences: q.rows[0] });
  } catch (err) {
    console.error('Error getting resident preferences:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

module.exports = router;