const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage for profile photos
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'burning-man-crm/profile-photos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }
    ]
  }
});

const upload = multer({
  storage: storage,
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
router.post('/profile-photo', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    console.log('📸 Profile photo upload request received');
    console.log('📸 User ID:', req.user._id);
    console.log('📸 File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');
    
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ message: 'No photo uploaded' });
    }

    // Cloudinary returns the URL in file.path
    const photoUrl = req.file.path;
    
    console.log('📸 Cloudinary URL:', photoUrl);

    // Update user's profile photo in database
    console.log('📸 Updating user profile photo in database');
    const db = require('../database/databaseAdapter');
    const user = await db.findUser({ _id: req.user._id });
    
    if (user) {
      console.log('📸 User found, updating photo URL');
      
      // Delete old Cloudinary image if it exists and is a Cloudinary URL
      if (user.profilePhoto && user.profilePhoto.includes('cloudinary.com')) {
        try {
          // Extract public_id from Cloudinary URL
          const urlParts = user.profilePhoto.split('/');
          const filename = urlParts[urlParts.length - 1];
          const publicId = `burning-man-crm/profile-photos/${filename.split('.')[0]}`;
          await cloudinary.uploader.destroy(publicId);
          console.log('🗑️ Old profile photo deleted from Cloudinary');
        } catch (deleteError) {
          console.error('⚠️ Failed to delete old photo:', deleteError.message);
          // Continue anyway - not critical
        }
      }
      
      await db.updateUser(user.email, { profilePhoto: photoUrl });
      console.log('✅ Profile photo updated successfully');
    } else {
      console.log('❌ User not found in database');
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile photo uploaded successfully',
      photoUrl: photoUrl
    });

  } catch (error) {
    console.error('❌ Profile photo upload error:', error);
    console.error('❌ Error stack:', error.stack);
    
    // More specific error messages
    let errorMessage = 'Failed to upload profile photo';
    
    if (error.message) {
      errorMessage = error.message;
    }
    
    if (error.message && error.message.includes('Cloudinary')) {
      errorMessage = 'Image hosting service error. Please check configuration.';
    } else if (error.message && error.message.includes('Only image files')) {
      errorMessage = 'Only image files are allowed';
    } else if (error.name === 'ValidationError') {
      errorMessage = 'Invalid photo data';
    }
    
    res.status(500).json({ message: errorMessage });
  }
});

module.exports = router;
