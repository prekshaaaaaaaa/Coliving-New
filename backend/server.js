// backend/server.js
require('dotenv').config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const admin = require("firebase-admin");
const fs = require('fs');

// Initialize DB (import pool so db.js runs its startup check)
const pool = require('./db');

// Global error handlers to prevent unhandled exceptions from silently crashing the process
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // In many apps you may want to exit and restart. For dev, we log and continue.
});

const app = express();
const http = require('http');
const { Server } = require('socket.io');

// Create uploads folder
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// Routes
app.use("/api/matches", require("./Routes/matchRoutes"));
app.use("/api/chat", require("./Routes/chatRoutes"));
app.use("/api/preferences", require("./Routes/preferenceRoutes"));
app.use("/api/debug", require("./Routes/debugRoutes"));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

app.post("/api/upload-aadhaar", upload.single("aadhaarXml"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file" });
  res.json({ message: "Uploaded", filePath: `/uploads/${req.file.filename}` });
});

app.post("/setRole", async (req, res) => {
  const { uid, role } = req.body;
  if (!uid || !['flatmate', 'roommate'].includes(role)) {
    return res.status(400).json({ success: false, error: "Invalid input" });
  }
  try {
    await admin.auth().setCustomUserClaims(uid, { role });
    res.json({ success: true, message: `Role ${role} set` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use("/uploads", express.static("uploads"));

const PORT = process.env.PORT || 5000;

// Create HTTP server and attach Socket.IO for realtime chat
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Expose io via the express app so routes can emit events
app.set('io', io);

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join', ({ roomId, userId }) => {
    try {
      const roomName = `chat_${roomId}`;
      socket.join(roomName);
      socket.data.userId = userId;
      console.log(`Socket ${socket.id} joined room ${roomName}`);
    } catch (e) {
      console.warn('Error in join handler', e.message);
    }
  });

  socket.on('leave', ({ roomId }) => {
    const roomName = `chat_${roomId}`;
    socket.leave(roomName);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected', socket.id, reason);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Socket.IO attached`);
  console.log(`Update SERVER_IP in frontend/config.js`);
});