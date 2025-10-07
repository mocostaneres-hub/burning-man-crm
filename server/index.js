const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Database connection
const db = require('./database/databaseAdapter');

// Try to connect to MongoDB, fall back to mock database if it fails
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB connected successfully');
  db.setMongoDBMode(true);
})
.catch(err => {
  console.log('MongoDB connection failed, using mock database for development');
  console.log('Error:', err.message);
  db.setMongoDBMode(false);
});

// Routes
app.use('/api/health', require('./routes/health'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/camps', require('./routes/camps'));
app.use('/api/members', require('./routes/members'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/rosters', require('./routes/rosters'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/upload', require('./routes/profile-photos'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/role-management', require('./routes/roleManagement'));
app.use('/api/oauth', require('./routes/oauth'));
app.use('/api/help', require('./routes/help'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/call-slots', require('./routes/callSlots'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/shifts-test', require('./routes/shifts-test'));
try {
  console.log('Loading shifts-minimal router...');
  app.use('/api/test-shifts', require('./routes/shifts-minimal'));
  console.log('✅ shifts-minimal router loaded');
} catch (error) {
  console.error('❌ Error loading shifts-minimal router:', error);
}

try {
  console.log('Loading shifts router...');
  app.use('/api/shifts', require('./routes/shifts'));
  console.log('✅ shifts router loaded');
} catch (error) {
  console.error('❌ Error loading shifts router:', error);
}
app.use('/api', require('./routes/invites'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/perks', require('./routes/perks'));
app.use('/api/admin/perks', require('./routes/adminPerks'));
app.use('/api/skills', require('./routes/skills'));

// Socket.io for real-time features
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-camp', (campId) => {
    socket.join(`camp-${campId}`);
  });
  
  socket.on('leave-camp', (campId) => {
    socket.leave(`camp-${campId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found - Railway deployment test ' + new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };
// Deployment trigger - Fix Railway startup error
