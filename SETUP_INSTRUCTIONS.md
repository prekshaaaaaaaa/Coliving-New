# API Setup Instructions

## Fix Network/API Errors

### Step 1: Find Your Computer's IP Address

**Windows:**
1. Open Command Prompt (cmd)
2. Type: `ipconfig`
3. Look for "IPv4 Address" under your active network adapter (usually WiFi or Ethernet)
4. Copy the IP address (e.g., `192.168.1.100`)

**Mac/Linux:**
1. Open Terminal
2. Type: `ifconfig` or `ip addr`
3. Look for your active network interface (usually `en0` or `wlan0`)
4. Find the `inet` address (e.g., `192.168.1.100`)

### Step 2: Update Frontend Config

1. Open `Coliving-Hub/frontend/config.js`
2. Find line 10: `let SERVER_IP = null;`
3. Replace `null` with your IP address in quotes:
   ```javascript
   let SERVER_IP = '192.168.1.100'; // Replace with your actual IP
   ```
4. Save the file

### Step 3: Start Backend Server

1. Open a terminal/command prompt
2. Navigate to the backend folder:
   ```bash
   cd Coliving-Hub/backend
   ```
3. Install dependencies (if not already done):
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   node server.js
   ```
5. You should see: `Server started on http://0.0.0.0:5000`

### Step 4: Verify Connection

1. Make sure your phone and computer are on the **same WiFi network**
2. Start your Expo app
3. Try selecting a role - it should work now!

## Troubleshooting

### Still Getting Network Errors?

1. **Check Backend is Running**
   - Look for the server console message
   - Try accessing `http://YOUR_IP:5000` in a browser (should show CORS error, which is normal)

2. **Verify IP Address**
   - Make sure the IP in `config.js` matches your computer's current IP
   - IP addresses can change when you reconnect to WiFi

3. **Check Firewall**
   - Windows: Allow Node.js through Windows Firewall
   - Mac: System Preferences > Security & Privacy > Firewall

4. **Same Network**
   - Phone and computer MUST be on the same WiFi network
   - Mobile data won't work - must use WiFi

5. **Port 5000**
   - Make sure nothing else is using port 5000
   - You can change the port in `server.js` if needed

### Common Error Messages

- **"Network request failed"**: Backend not running or wrong IP address
- **"Request timeout"**: Backend is running but not accessible (firewall/network issue)
- **"SERVER_IP not configured"**: You need to set the IP in config.js

## Quick Test

To test if your backend is accessible:
1. Open a browser on your phone (same WiFi network)
2. Go to: `http://YOUR_IP:5000`
3. You should see a response (even if it's an error, that means it's reachable)

