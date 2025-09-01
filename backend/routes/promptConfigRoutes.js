const express = require('express');
const router = express.Router();
const promptConfigController = require('../controllers/promptConfigController');
const { protect } = require('../middleware/authMiddleware');

// Protected routes (require authentication)
router.use(protect);

// Get all prompt configurations
router.get('/', promptConfigController.getAllPromptConfigs);

// Get a prompt configuration by domain
router.get('/:domain', promptConfigController.getPromptConfigByDomain);

// Create a new prompt configuration (admin only)
router.post('/', promptConfigController.createPromptConfig);

// Update a prompt configuration (admin only)
router.patch('/:domain', promptConfigController.updatePromptConfig);

// Delete a prompt configuration (admin only)
router.delete('/:domain', promptConfigController.deletePromptConfig);

module.exports = router;