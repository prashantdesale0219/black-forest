const express = require('express');
const router = express.Router();
const creditController = require('../controllers/creditController');
const { protect } = require('../middleware/authMiddleware');

// Protected routes (require authentication)
router.use(protect);

// Get user's credit balance
router.get('/', creditController.getUserCredits);

// Get user's usage history
router.get('/usage', creditController.getUserUsageHistory);

// Purchase credits
router.post('/purchase', creditController.purchaseCredits);

// Admin routes
router.post('/add', creditController.addCredits); // Add credits to user (admin only)
router.get('/stats', creditController.getCreditStats); // Get credit usage statistics (admin only)

module.exports = router;