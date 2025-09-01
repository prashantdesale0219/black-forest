const express = require('express');
const router = express.Router();
const tryOnController = require('../controllers/tryOnController');
const { protect } = require('../middleware/authMiddleware');

// Protected routes (require authentication)
router.use(protect);

// Create a new try-on job
router.post('/', tryOnController.createTryOnJob);

// Get all try-on jobs for the current user
router.get('/', tryOnController.getUserTryOnJobs);

// Get a specific try-on job by ID
router.get('/:id', tryOnController.getTryOnJobById);

// Check try-on job status
router.get('/:id/status', tryOnController.checkTryOnStatus);

// Delete a try-on job
router.delete('/:id', tryOnController.deleteTryOnJob);

module.exports = router;