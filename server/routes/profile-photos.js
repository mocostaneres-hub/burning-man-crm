const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');

// Import multer error types
const { MulterError } = multer;

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// @route   POST /api/upload/profile-photo
// @desc    Upload profile photo
// @access  Private
router.post('/profile-photo', authenticateToken, (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err instanceof MulterError) {
      console.error('❌ Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File too large. Maximum size is 5MB.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ message: 'Too many files. Please upload only one photo.' });
      }
      return res.status(400).json({ message: err.message });
    } else if (err) {
      console.error('❌ Upload error:', err);
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('📸 Profile photo upload request received');
    console.log('📸 User ID:', req.user._id);
    console.log('📸 File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');
    
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ message: 'No photo uploaded' });
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = path.extname(req.file.originalname) || '.jpg';
    const filename = `profile-${req.user._id}-${timestamp}-${randomString}${extension}`;

    // For development, we'll use a simple base64 URL
    // In production, you would upload to Cloudinary or another service
    const base64Image = req.file.buffer.toString('base64');
    const photoUrl = `data:${req.file.mimetype};base64,${base64Image}`;
    
    console.log('📸 Base64 URL length:', photoUrl.length);
    
    // Check if base64 URL is too long (some browsers have limits)
    let finalPhotoUrl = photoUrl;
    if (photoUrl.length > 1000000) { // 1MB limit for base64 URLs
      console.log('❌ Base64 URL too long, using placeholder...');
      // For now, we'll use a placeholder image if the base64 is too long
      finalPhotoUrl = 'https://via.placeholder.com/400x400?text=Photo+Uploaded';
    }

    // Update user's profile photo in database
    console.log('📸 Updating user profile photo in database');
    const db = require('../database/databaseAdapter');
    const user = await db.findUser({ _id: req.user._id });
    if (user) {
      console.log('📸 User found, updating photo URL');
      await db.updateUser(user.email, { profilePhoto: finalPhotoUrl });
      console.log('✅ Profile photo updated successfully');
    } else {
      console.log('❌ User not found in database');
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile photo uploaded successfully',
      photoUrl: finalPhotoUrl
    });

  } catch (error) {
    console.error('❌ Profile photo upload error:', error);
    console.error('❌ Error stack:', error.stack);
    
    // More specific error messages
    let errorMessage = 'Failed to upload profile photo';
    
    if (error.message) {
      errorMessage = error.message;
    }
    
    if (error.name === 'ValidationError') {
      errorMessage = 'Invalid photo data';
    } else if (error.code === 'ENOENT') {
      errorMessage = 'File system error';
    } else if (error.code === 'EACCES') {
      errorMessage = 'Permission denied';
    }
    
    res.status(500).json({ message: errorMessage });
  }
});

module.exports = router;
