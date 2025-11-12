# Tinder-like Swipeable Matches Feature

## Overview
A Tinder-like swipeable interface for viewing and accepting/rejecting roommate/resident matches.

## Features

### 1. Swipeable Cards
- **Swipe Right** (or tap green button): Accept match
- **Swipe Left** (or tap red button): Reject match
- Visual feedback with "LIKE" and "NOPE" overlays
- Smooth animations

### 2. Match Display
- Shows compatibility score as a badge
- Displays key preferences:
  - Profession
  - Budget (max rent)
  - Dietary preference
  - Environment preference
  - Cleanliness habits
  - Schedule
  - Location

### 3. API Endpoints

#### Get Matches
- **Roommate**: `GET /api/matches/roommate-matches/:userId`
- **Resident**: `GET /api/matches/resident-matches/:userId`

Returns matches with compatibility scores ≥ 30%, sorted by score.

#### Accept/Reject Match
- **Endpoint**: `POST /api/matches/action`
- **Body**:
  ```json
  {
    "userId": "firebase_uid",
    "matchId": "resident_id or roommate_id",
    "action": "accept" or "reject",
    "matchType": "resident" or "roommate"
  }
  ```

## How to Use

### For Users:
1. Fill out preferences form (Roommate or Resident)
2. Navigate to Matches screen
3. Swipe right to accept, left to reject
4. Or use the action buttons at the bottom

### Navigation:
```javascript
navigation.navigate("Matches");
```

## Database Requirements

The matches table should have:
- `resident_id` (references residents table)
- `roommate_id` (references roommates table)
- `compatibility_score` (integer)
- `status` (varchar, default 'pending')
- `matched_on` (timestamp)
- Unique constraint on (resident_id, roommate_id)

## Components

### SwipeableCard
- Located: `frontend/components/SwipeableCard.js`
- Props:
  - `match`: Match object with preferences
  - `onSwipeLeft`: Callback for reject
  - `onSwipeRight`: Callback for accept
  - `index`: Card index for stacking

### MatchesScreen
- Located: `frontend/Screens/MatchesScreen.js`
- Features:
  - Fetches matches based on user role
  - Displays cards in stack
  - Handles accept/reject actions
  - Shows remaining matches count

## Styling
- Uses theme context for colors
- Supports dark mode
- Responsive design
- Smooth animations

## Future Enhancements
- Add match details modal
- Show mutual matches
- Add chat functionality
- Filter matches by preferences
- Save matches for later review

