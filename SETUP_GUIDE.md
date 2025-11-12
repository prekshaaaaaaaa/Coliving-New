# Quick Setup Guide for Expo Go

## Step 1: Fix Package Versions (Already Done)
✅ Package versions have been updated to match Expo requirements

## Step 2: Install Dependencies
```bash
cd Coliving-Hub/frontend
npm install
```

## Step 3: Find Your IP Address

### Windows:
1. Open Command Prompt
2. Run: `ipconfig`
3. Find "IPv4 Address" (e.g., `192.168.1.105`)

### Mac/Linux:
1. Open Terminal
2. Run: `ifconfig`
3. Find "inet" address (e.g., `192.168.1.105`)

## Step 4: Update Config File
1. Open `Coliving-Hub/frontend/config.js`
2. Find line 10: `let SERVER_IP = null;`
3. Replace with your IP:
   ```javascript
   let SERVER_IP = '192.168.1.105'; // YOUR IP HERE
   ```
4. Save the file

## Step 5: Start Backend Server
```bash
cd Coliving-Hub/backend
node server.js
```

You should see:
```
Server started on http://0.0.0.0:5000
Server accessible at http://localhost:5000
```

## Step 6: Start Expo App
```bash
cd Coliving-Hub/frontend
npx expo start --clear
```

## Step 7: Open in Expo Go
1. Scan the QR code with Expo Go app on your phone
2. Make sure phone and computer are on the same WiFi
3. The app should load!

## Troubleshooting

### App shows blank screen:
- Check console for errors
- Verify IP address is correct in config.js
- Make sure backend is running

### "Network request failed":
- Verify IP address in config.js matches your computer's IP
- Check phone and computer are on same WiFi
- Make sure backend server is running

### Package version warnings:
- Run: `npm install` again
- The warnings are usually safe to ignore

### Backend not starting:
- Check if port 5000 is already in use
- Make sure all dependencies are installed: `npm install` in backend folder

