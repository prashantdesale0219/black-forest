const express = require('express');
const router = express.Router();
const sceneController = require('../controllers/sceneController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');

// Public routes with optional authentication
router.get('/public', optionalAuth, sceneController.getPublicScenes);
router.get('/:id', optionalAuth, sceneController.getSceneById);

// Protected routes (require authentication)
router.use(protect);

// Generate a scene using BFL API
router.post('/generate', sceneController.generateScene);

// Upload a scene image
router.post('/upload', uploadSingle('image'), sceneController.uploadScene);

// Get all scenes for the current user
router.get('/', sceneController.getUserScenes);

// Check scene generation status
router.get('/:id/status', sceneController.checkGenerationStatus);

// Update scene details
router.patch('/:id', sceneController.updateScene);

// Delete a scene
router.delete('/:id', sceneController.deleteScene);

module.exports = router;