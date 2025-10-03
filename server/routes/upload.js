const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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
// @access  Private (Camp lead only)
router.post('/camp-photo/:campId', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const Camp = require('../models/Camp');
    const camp = await Camp.findById(req.params.campId);
    
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Check if user is camp lead
    if (camp.contactEmail !== req.user.email) {
      return res.status(403).json({ message: 'Not authorized to upload photos for this camp' });
    }

    // Add photo to camp
    const photoData = {
      url: req.file.path,
      caption: req.body.caption || '',
      isPrimary: req.body.isPrimary === 'true'
    };

    // If this is set as primary, unset other primary photos
    if (photoData.isPrimary) {
      camp.photos.forEach(photo => {
        photo.isPrimary = false;
      });
    }

    camp.photos.push(photoData);
    await camp.save();

    res.json({
      message: 'Camp photo uploaded successfully',
      photo: photoData
    });

  } catch (error) {
    console.error('Upload camp photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
