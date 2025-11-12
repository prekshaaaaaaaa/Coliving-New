# Mutual Matching & Chat System

## Overview
A complete mutual matching system where users can select/reject each other, and when both users select each other, a match is created with automatic chat room generation.

## Features

### 1. Selection System
- **Swipe Right (Accept)**: User selects another user
- **Swipe Left (Reject)**: User rejects another user (permanently removed from suggestions)
- Selections are stored in `user_selections` table

### 2. Mutual Matching
- When User A selects User B AND User B selects User A:
  - Match record created with status='matched'
  - Chat room automatically created
  - Both users notified

### 3. Chat System
- Chat rooms created automatically on mutual match
- Only matched users can access chat
- Real-time message polling (every 3 seconds)
- Messages stored in `messages` table

## Database Schema

### Required Tables:

```sql
-- User selections (accept/reject)
CREATE TABLE user_selections (
  selection_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(user_id),
  selected_user_id INTEGER REFERENCES users(user_id),
  action VARCHAR(20) CHECK (action IN ('accept', 'reject')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, selected_user_id)
);

-- Chat rooms (auto-created on match)
CREATE TABLE chat_rooms (
  chat_room_id SERIAL PRIMARY KEY,
  user1_id INTEGER REFERENCES users(user_id),
  user2_id INTEGER REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

-- Messages
CREATE TABLE messages (
  message_id SERIAL PRIMARY KEY,
  chat_room_id INTEGER REFERENCES chat_rooms(chat_room_id),
  sender_id INTEGER REFERENCES users(user_id),
  message_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Update matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'matched';
```

## API Endpoints

### Matching:
- `POST /api/matches/action` - Accept/reject a user
  - Returns `isMatch: true` if mutual match
  - Auto-creates chat room on mutual match

- `GET /api/matches/mutual-matches/:userId` - Get all mutual matches
  - Returns matches with chat_room_id

### Chat:
- `GET /api/chat/rooms/:userId` - Get all chat rooms
- `GET /api/chat/messages/:roomId?userId=xxx` - Get messages (access verified)
- `POST /api/chat/messages` - Send message (access verified)

## User Flow

### For Roommates:
1. Fill preferences form → Saved to database
2. Navigate to Matches screen → See potential residents
3. Swipe right on a resident → Selection saved
4. If resident also swiped right → **MATCH!** 🎉
5. Chat room created automatically
6. View matches in "My Matches" screen
7. Open chat to message matched user

### For Residents:
1. Fill preferences form → Saved to database
2. Navigate to Matches screen → See potential roommates
3. Swipe right on a roommate → Selection saved
4. If roommate also swiped right → **MATCH!** 🎉
5. Chat room created automatically
6. View matches in "My Matches" screen
7. Open chat to message matched user

## Frontend Screens

### 1. MatchesScreen
- Tinder-like swipeable interface
- Shows potential matches based on preferences
- Swipe right = accept, left = reject
- Shows match notification when mutual match occurs

### 2. MatchedUsersScreen
- Lists all mutual matches
- Shows match date
- Tap to open chat
- Accessible from Profile screen

### 3. ChatScreen
- Real-time messaging (3-second polling)
- Only accessible for matched users
- Shows message history
- Send/receive messages

## Security Features

1. **Access Control**: Chat rooms verify user access on every request
2. **Rejection Tracking**: Rejected users permanently excluded
3. **Match Verification**: Only status='matched' records allow chat access
4. **User Verification**: All endpoints verify Firebase UID

## Navigation

- **Profile Screen** → "My Matches" button → MatchedUsersScreen
- **MatchedUsersScreen** → Tap match → ChatScreen
- **MatchesScreen** → Mutual match alert → Option to navigate to MatchedUsersScreen

## Testing

The system works with:
- Real database (when connected)
- Mock data (when database not connected)
- All features work identically in both modes

