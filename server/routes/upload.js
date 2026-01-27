const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { authenticateToken, requireCampAccount } = require('../middleware/auth');
const { getUserCampId, canAccessCamp } = require('../utils/permissionHelpers');
const db = require('../database/databaseAdapter');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Validate Cloudinary configuration on startup
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('❌ [Upload] Cloudinary configuration missing!');
  console.error('   CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'set' : 'MISSING');
  console.error('   CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'set' : 'MISSING');
  console.error('   CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'set' : 'MISSING');
  console.error('   Photo uploads will fail!');
} else {
  console.log('✅ [Upload] Cloudinary configured:', process.env.CLOUDINARY_CLOUD_NAME);
}

// Configure multer with Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'burning-man-crm',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 1200, height: 1200, crop: 'limit', quality: 'auto' }
    ]
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});


// @route   POST /api/upload/camp-photos
// @desc    Upload camp photos
// @access  Private (Camp accounts only)
router.post('/camp-photos', authenticateToken, upload.array('photos', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.accountType !== 'camp') {
      return res.status(403).json({ message: 'Only camp accounts can upload camp photos' });
    }

    // Add new photos to camp photos array
    const newPhotos = req.files.map(file => file.path);
    if (!user.campPhotos) user.campPhotos = [];
    user.campPhotos.push(...newPhotos);

    await user.save();

    res.json({
      message: 'Camp photos uploaded successfully',
      photos: newPhotos
    });

  } catch (error) {
    console.error('Upload camp photos error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/upload/photo/:publicId
// @desc    Delete photo
// @access  Private
router.delete('/photo/:publicId', authenticateToken, async (req, res) => {
  try {
    const { publicId } = req.params;

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(`burning-man-crm/${publicId}`);
    
    if (result.result === 'not found') {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Remove from user's photos
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    
    if (user) {
      const photoUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/v${Date.now()}/${publicId}`;
      
      if (user.accountType === 'personal') {
        if (user.profilePhoto === photoUrl) {
          user.profilePhoto = null;
        }
      } else {
        if (user.campPhotos) {
          user.campPhotos = user.campPhotos.filter(photo => photo !== photoUrl);
        }
      }
      
      await user.save();
    }

    res.json({ message: 'Photo deleted successfully' });

  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/upload/camp-photo/:campId
// @desc    Upload photo for specific camp
// @access  Private (Camp account or Camp Admin)
router.post('/camp-photo/:campId', authenticateToken, requireCampAccount, upload.single('photo'), async (req, res) => {
  try {
    console.log('📸 [Camp Photo Upload] Route handler started');
    console.log('📸 [Camp Photo Upload] req.file:', req.file ? 'present' : 'missing');
    console.log('📸 [Camp Photo Upload] campId:', req.params.campId);
    
    if (!req.file) {
      console.error('❌ [Camp Photo Upload] No file in request - multer may have failed');
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const campId = req.params.campId;
    
    // Validate campId format for MongoDB
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(campId)) {
      console.error('❌ [Camp Photo Upload] Invalid campId format:', campId);
      return res.status(400).json({ message: 'Invalid camp ID format' });
    }
    
    console.log('📸 [Camp Photo Upload] Looking up camp:', campId);
    const camp = await db.findCamp({ _id: campId });
    
    if (!camp) {
      console.log('❌ [Camp Photo Upload] Camp not found:', campId);
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Authorization already handled by requireCampAccount middleware
    console.log('✅ [Camp Photo Upload] Authorized for camp:', camp._id);
    console.log('📸 [Camp Photo Upload] File uploaded:', req.file.originalname, req.file.size, 'bytes');
    console.log('📸 [Camp Photo Upload] Cloudinary URL:', req.file.path);

    // Add photo to camp
    const photoData = {
      url: req.file.path,
      caption: req.body.caption || '',
      isPrimary: req.body.isPrimary === 'true'
    };

    // Initialize photos array if it doesn't exist or handle different formats
    let photos = [];
    if (camp.photos) {
      // Handle both array of objects and array of strings
      if (Array.isArray(camp.photos)) {
        photos = camp.photos.map(photo => {
          if (typeof photo === 'string') {
            // Convert string URL to object format
            return { url: photo, caption: '', isPrimary: false };
          }
          return photo;
        });
      }
    }

    // If this is set as primary, unset other primary photos
    if (photoData.isPrimary) {
      photos = photos.map(photo => ({
        ...photo,
        isPrimary: false
      }));
    }

    // Add new photo to array
    photos.push(photoData);

    console.log('📸 [Camp Photo Upload] Updating camp with', photos.length, 'photos');

    // Update camp using database adapter (handles both MongoDB and mock DB)
    const updatedCamp = await db.updateCampById(campId, {
      photos: photos,
      updatedAt: new Date()
    });

    if (!updatedCamp) {
      console.error('❌ [Camp Photo Upload] Failed to update camp - updateCampById returned null');
      return res.status(500).json({ message: 'Failed to save photo to camp' });
    }

    console.log('✅ [Camp Photo Upload] Photo added successfully to camp:', campId);

    res.json({
      message: 'Camp photo uploaded successfully',
      photo: photoData
    });

  } catch (error) {
    console.error('❌ [Camp Photo Upload] Error:', error);
    console.error('❌ [Camp Photo Upload] Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
