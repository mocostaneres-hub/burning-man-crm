const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const db = require('../database/databaseAdapter');

// GET /api/categories - Get all camp categories (public endpoint)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 [GET /api/categories] Fetching all camp categories');
    
    const categories = await db.findCampCategories();
    
    console.log(`✅ [GET /api/categories] Found ${categories.length} categories`);
    
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('❌ [GET /api/categories] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// POST /api/categories - Create new camp category (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 [POST /api/categories] Creating new category:', req.body);
    
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }
    
    const category = await db.createCampCategory({
      name: name.trim()
    });
    
    console.log('✅ [POST /api/categories] Created category:', category._id);
    
    res.status(201).json({
      success: true,
      category
    });
  } catch (error) {
    console.error('❌ [POST /api/categories] Error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A category with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message
    });
  }
});

// PUT /api/categories/:id - Update camp category (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 [PUT /api/categories/:id] Updating category:', req.params.id, req.body);
    
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }
    
    const category = await db.updateCampCategory(req.params.id, {
      name: name.trim()
    });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    console.log('✅ [PUT /api/categories/:id] Updated category:', category._id);
    
    res.json({
      success: true,
      category
    });
  } catch (error) {
    console.error('❌ [PUT /api/categories/:id] Error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A category with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    });
  }
});

// DELETE /api/categories/:id - Delete camp category (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 [DELETE /api/categories/:id] Deleting category:', req.params.id);
    
    const category = await db.deleteCampCategory(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    console.log('✅ [DELETE /api/categories/:id] Deleted category:', category._id);
    
    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('❌ [DELETE /api/categories/:id] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    });
  }
});

module.exports = router;
