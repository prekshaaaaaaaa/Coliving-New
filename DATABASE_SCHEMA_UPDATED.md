# Updated Database Schema for Mutual Matching & Chat

## New Tables Required

### 1. `user_selections` Table

Tracks user selections (accept/reject) before mutual matching:

```sql
CREATE TABLE IF NOT EXISTS user_selections (
  selection_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  selected_user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('accept', 'reject')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, selected_user_id)
);

CREATE INDEX idx_user_selections_user ON user_selections(user_id);
CREATE INDEX idx_user_selections_selected ON user_selections(selected_user_id);
```

### 2. `chat_rooms` Table

Stores chat rooms created automatically on mutual match:

```sql
CREATE TABLE IF NOT EXISTS chat_rooms (
  chat_room_id SERIAL PRIMARY KEY,
  user1_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  user2_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

CREATE INDEX idx_chat_rooms_user1 ON chat_rooms(user1_id);
CREATE INDEX idx_chat_rooms_user2 ON chat_rooms(user2_id);
```

### 3. `messages` Table

Stores chat messages:

```sql
CREATE TABLE IF NOT EXISTS messages (
  message_id SERIAL PRIMARY KEY,
  chat_room_id INTEGER REFERENCES chat_rooms(chat_room_id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_room ON messages(chat_room_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at);
```

### 4. Updated `matches` Table

Add status column if not exists:

```sql
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- Update existing matches to 'matched' if they should be
UPDATE matches SET status = 'matched' WHERE status IS NULL;
```

## How It Works

### Selection Flow:

1. User A swipes right on User B → Selection saved as 'accept'
2. User B swipes right on User A → Selection saved as 'accept'
3. System detects mutual selection → Creates match with status 'matched'
4. Chat room automatically created for the matched users

### Rejection Flow:

1. User swipes left → Selection saved as 'reject'
2. Rejected user is excluded from future match suggestions
3. No match record created

### Chat Access:

- Only users with status='matched' can access chat
- Chat room is created automatically on mutual match
- Messages are stored with chat_room_id reference

## API Endpoints

### Match Actions:

- `POST /api/matches/action` - Accept/reject a user
  - Returns `isMatch: true` if mutual match
  - Automatically creates chat room on mutual match

### Mutual Matches:

- `GET /api/matches/mutual-matches/:userId` - Get all mutual matches
  - Returns matches with chat_room_id

### Chat:

- `GET /api/chat/rooms/:userId` - Get all chat rooms for user
- `GET /api/chat/messages/:roomId?userId=xxx` - Get messages (verifies access)
- `POST /api/chat/messages` - Send message (verifies access)

## Security

- Chat room access is verified on every request
- Users can only see messages from their own chat rooms
- Rejected users are permanently excluded from suggestions
- Mutual matches are required for chat access
