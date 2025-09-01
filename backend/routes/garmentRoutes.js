const express = require('express');
const router = express.Router();
const garmentController = require('../controllers/garmentController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');

// Public routes with optional authentication
router.get('/public', optionalAuth, garmentController.getPublicGarments);
router.get('/:id', optionalAuth, garmentController.getGarmentById);

// Protected routes (require authentication)
router.use(protect);

// Upload a garment image
router.post('/upload', uploadSingle('image'), garmentController.uploadGarment);

// Get all garments for the current user
router.get('/', garmentController.getUserGarments);

// Update garment details
router.patch('/:id', garmentController.updateGarment);

// Delete a garment
router.delete('/:id', garmentController.deleteGarment);

module.exports = router;