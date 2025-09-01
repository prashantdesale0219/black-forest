const express = require('express');
const router = express.Router();
const modelController = require('../controllers/modelController');
const { protect } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');

// Protected routes (require authentication)
router.use(protect);

// Generate a model using BFL API
router.post('/generate', modelController.generateModel);

// Upload a model image
router.post('/upload', uploadSingle('image'), modelController.uploadModel);

// Get all models for the current user
router.get('/', modelController.getUserModels);

// Get a specific model by ID
router.get('/:id', modelController.getModelById);

// Check model generation status
router.get('/:id/status', modelController.checkGenerationStatus);

// Update model details
router.patch('/:id', modelController.updateModel);

// Delete a model
router.delete('/:id', modelController.deleteModel);

module.exports = router;