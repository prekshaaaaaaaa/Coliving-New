# Mock Data Feature for Matches

## Overview

The MatchesScreen now includes mock data that automatically displays when:

1. Database is not connected
2. API calls fail
3. No matches are found in the database

## How It Works

### Automatic Fallback

- The app first tries to fetch matches from the database
- If the API call fails or returns no matches, it automatically uses mock data
- A toast notification informs the user that demo data is being shown

### Mock Data Sets

#### For Roommates (5 mock residents):

1. **Priya Sharma** - 85% match
   - Software Engineer, Bangalore
   - Vegetarian, Quiet environment, Neat
2. **Rahul Kumar** - 78% match
   - Marketing Manager, Mumbai
   - Non-Vegetarian, Social environment
3. **Anjali Patel** - 72% match
   - Graphic Designer, Delhi
   - Vegetarian, Quiet environment
4. **Vikram Singh** - 68% match
   - Data Analyst, Pune
   - No dietary preference
5. **Sneha Reddy** - 65% match
   - Content Writer, Hyderabad
   - Vegetarian, Social environment

#### For Residents (5 mock roommates):

1. **Arjun Mehta** - 88% match
   - Product Manager, Bangalore
   - Vegetarian, Quiet environment
2. **Kavya Nair** - 82% match
   - UX Designer, Mumbai
   - Vegetarian, Quiet environment
3. **Rohan Desai** - 75% match
   - Business Analyst, Delhi
   - Non-Vegetarian, Social environment
4. **Meera Joshi** - 70% match
   - HR Manager, Pune
   - Vegetarian, Quiet environment
5. **Aditya Verma** - 67% match
   - Software Developer, Hyderabad
   - No dietary preference

## Features

### Visual Indicators

- Header shows "(Demo)" when using mock data
- Toast notifications indicate when demo data is active
- All swipe functionality works with mock data

### Behavior

- Swipe actions (accept/reject) work normally
- Toast messages show "(Demo)" for mock actions
- No API calls are made when using mock data
- All UI features work identically to real data

## Testing Without Database

To test the swipeable matches feature:

1. Navigate to Matches screen
2. If database isn't connected, mock data will automatically load
3. You'll see a toast: "Using Demo Data - Database not connected"
4. Swipe through the 5 mock matches
5. All interactions work normally

## Database Connection Status

The database connection is configured in `backend/db.js`:

- Host: `0.tcp.in.ngrok.io`
- Port: `16933`
- Database: `coliving_spaces`

To check if database is connected:

1. Check backend server logs
2. Look for "Connection failed" errors
3. If connection fails, mock data will be used automatically

## Switching to Real Data

Once database is connected:

1. The app will automatically use real data
2. No code changes needed
3. Mock data is only used as fallback
4. Real matches will replace mock data when available
