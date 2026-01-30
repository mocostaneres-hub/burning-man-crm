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
    origin: [
      process.env.CLIENT_URL,
      process.env.CORS_ORIGIN,
      'https://g8road.com',
      'https://www.g8road.com',
      'https://burning-man-crm.vercel.app',
      'http://localhost:3000'
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(helmet());

// Trust proxy - required for Railway and rate limiting
app.set('trust proxy', 1);

// CORS configuration to support multiple origins including Vercel previews
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN,
  'https://g8road.com',
  'https://www.g8road.com',
  'https://burning-man-crm.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed origins or Vercel preview URLs
    const isAllowed = allowedOrigins.indexOf(origin) !== -1 || 
                     allowedOrigins.some(allowed => origin.includes(allowed)) ||
                     origin.endsWith('.vercel.app'); // Allow all Vercel preview/staging URLs
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      console.log('✅ Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (placed early to catch all requests)
app.use((req, res, next) => {
  console.log(`📥 [${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log(`📥 Original URL: ${req.originalUrl}`);
  console.log(`📥 Base URL: ${req.baseUrl}`);
  next();
});

// Rate limiting (relaxed for development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 10000, // 10,000 for dev, 100 for production
  message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

// Database connection
const db = require('./database/databaseAdapter');

// Try to connect to MongoDB, fall back to mock database if it fails
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('MongoDB connected successfully');
  db.setMongoDBMode(true);
  
  // Validate schemas on startup
  try {
    const { validateAllSchemas } = require('./startup/validateSchemas');
    validateAllSchemas();
  } catch (validationError) {
    console.error('⚠️  [Startup] Schema validation failed:', validationError.message);
    // Don't crash in production, but log prominently
  }
  
  // Run automated camp owner repair on startup
  try {
    const { fixCampsMissingOwnersOnStartup } = require('./startup/fixCampsMissingOwners');
    await fixCampsMissingOwnersOnStartup();
  } catch (repairError) {
    console.error('⚠️  [Startup] Camp repair failed:', repairError.message);
    // Don't crash server if repair fails, just log it
  }
  
  // Auto-migrate photos on startup (if enabled)
  try {
    const { autoMigratePhotosOnStartup } = require('./startup/autoMigratePhotos');
    await autoMigratePhotosOnStartup();
  } catch (migrationError) {
    console.error('⚠️  [Startup] Photo migration failed:', migrationError.message);
    // Don't crash server if migration fails, just log it
  }
})
.catch(err => {
  console.log('MongoDB connection failed, using mock database for development');
  console.log('Error:', err.message);
  db.setMongoDBMode(false);
});

// Routes
app.use('/api/health', require('./routes/health'));
app.use('/api/debug-db', require('./routes/debug-db')); // Temporary debug route
app.use('/api/debug-admin', require('./routes/debug-admin')); // Temporary debug route
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/camps', require('./routes/camps'));
app.use('/api/members', require('./routes/members'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/rosters', require('./routes/rosters'));
// Register admin routes
try {
  const adminRouter = require('./routes/admin');
  app.use('/api/admin', adminRouter);
  console.log('✅ Admin routes registered at /api/admin');
} catch (error) {
  console.error('❌ Error loading admin routes:', error);
  throw error;
}
// Register diagnostic routes (admin only)
app.use('/api/diagnostic', require('./routes/diagnostic'));
// Register admin deletion routes (admin only - USE WITH CAUTION)
app.use('/api/admin-delete', require('./routes/admin-delete'));
app.use('/api/email', require('./routes/email'));
app.use('/api/admin/faqs', require('./routes/adminFAQs'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/upload', require('./routes/profile-photos'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/role-management', require('./routes/roleManagement'));
app.use('/api/oauth', require('./routes/oauth'));
app.use('/api/onboarding', require('./routes/onboarding'));
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
app.use('/api/mudskippers', require('./routes/mudskippers-applications'));
app.use('/api/migrate', require('./routes/migrate-application-statuses'));
app.use('/api/migrate', require('./routes/migrate-slugs'));
app.use('/api/migrate', require('./routes/migrate-photos'));
app.use('/api/debug', require('./routes/debug-user'));

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
  console.error('❌ [Error Handler] Error caught:', err.message);
  console.error('❌ [Error Handler] Stack:', err.stack);
  
  // Handle Multer errors specifically
  if (err.name === 'MulterError') {
    console.error('❌ [Error Handler] Multer error:', err.code);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File too large. Maximum size is 10MB.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: 'Unexpected field in upload. Expected field name: "photo" or "photos".' });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }
  
  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS policy does not allow access from your origin.' });
  }
  
  // Generic server error
  res.status(500).json({ 
    message: 'Something went wrong!',
    // Include error message in development for easier debugging
    ...(process.env.NODE_ENV !== 'production' && { error: err.message })
  });
});

// Debug: Log all registered routes (only in development or when DEBUG_ROUTES is set)
if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_ROUTES === 'true') {
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      console.log(`📍 Route: ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      console.log(`📍 Router mounted at: ${middleware.regexp}`);
    }
  });
}


// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  console.log(`❌ Original URL: ${req.originalUrl}`);
  console.log(`❌ Base URL: ${req.baseUrl}`);
  res.status(404).json({ 
    message: 'Route not found - Railway deployment test ' + new Date().toISOString(),
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };
// Deployment trigger - Fix Railway startup error
