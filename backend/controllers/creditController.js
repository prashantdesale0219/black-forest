const User = require('../models/User');
const UsageLog = require('../models/UsageLog');
const { AppError } = require('../middleware/errorHandler');

/**
 * Controller for credit and usage tracking operations
 */
const creditController = {
  /**
   * Get user's credit balance and usage history
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getUserCredits: async (req, res, next) => {
    try {
      const userId = req.user.id;
      
      const user = await User.findById(userId).select('credits');
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      
      res.status(200).json({
        success: true,
        data: {
          credits: user.credits
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get user's usage history
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getUserUsageHistory: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10, action } = req.query;
      
      const query = { userId };
      if (action && ['model_generation', 'tryon', 'scene_change', 'other'].includes(action)) {
        query.action = action;
      }
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { timestamp: -1 }
      };
      
      const usageLogs = await UsageLog.find(query)
        .skip((options.page - 1) * options.limit)
        .limit(options.limit)
        .sort(options.sort);
      
      const total = await UsageLog.countDocuments(query);
      
      res.status(200).json({
        success: true,
        data: {
          usageLogs,
          pagination: {
            total,
            page: options.page,
            limit: options.limit,
            pages: Math.ceil(total / options.limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Add credits to user account (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  addCredits: async (req, res, next) => {
    try {
      // Only admin can add credits
      if (req.user.role !== 'admin') {
        return next(new AppError('You do not have permission to add credits', 403));
      }
      
      const { userId, amount, reason } = req.body;
      
      if (!userId) {
        return next(new AppError('User ID is required', 400));
      }
      
      if (!amount || isNaN(amount) || amount <= 0) {
        return next(new AppError('Valid credit amount is required', 400));
      }
      
      const user = await User.findById(userId);
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      
      // Add credits
      user.credits.balance += amount;
      user.credits.totalPurchased += amount;
      user.credits.lastPurchase = {
        amount,
        date: Date.now(),
        reason: reason || 'Admin credit adjustment'
      };
      
      await user.save();
      
      // Log the credit addition
      await new UsageLog({
        userId,
        action: 'other',
        creditsUsed: -amount, // Negative to indicate credit addition
        details: { reason: reason || 'Admin credit adjustment' }
      }).save();
      
      res.status(200).json({
        success: true,
        message: `${amount} credits added to user account`,
        data: {
          userId,
          newBalance: user.credits.balance
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Purchase credits (for future payment integration)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  purchaseCredits: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { packageId } = req.body;
      
      // Credit packages (to be moved to database or config in production)
      const creditPackages = {
        'basic': { credits: 10, price: 5.99 },
        'standard': { credits: 25, price: 12.99 },
        'premium': { credits: 60, price: 24.99 }
      };
      
      if (!packageId || !creditPackages[packageId]) {
        return next(new AppError('Invalid package selected', 400));
      }
      
      const package = creditPackages[packageId];
      
      // TODO: Integrate with payment gateway
      // For now, we'll just add the credits directly
      
      const user = await User.findById(userId);
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      
      // Add credits
      user.credits.balance += package.credits;
      user.credits.totalPurchased += package.credits;
      user.credits.lastPurchase = {
        amount: package.credits,
        date: Date.now(),
        reason: `Purchased ${packageId} package`
      };
      
      await user.save();
      
      // Log the purchase
      await new UsageLog({
        userId,
        action: 'other',
        creditsUsed: -package.credits, // Negative to indicate credit addition
        details: { reason: `Purchased ${packageId} package`, price: package.price }
      }).save();
      
      res.status(200).json({
        success: true,
        message: `${package.credits} credits added to your account`,
        data: {
          newBalance: user.credits.balance,
          package: {
            name: packageId,
            credits: package.credits,
            price: package.price
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get credit usage statistics (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getCreditStats: async (req, res, next) => {
    try {
      // Only admin can view credit stats
      if (req.user.role !== 'admin') {
        return next(new AppError('You do not have permission to view credit statistics', 403));
      }
      
      // Get total credits in system
      const totalCreditsResult = await User.aggregate([
        {
          $group: {
            _id: null,
            totalBalance: { $sum: '$credits.balance' },
            totalPurchased: { $sum: '$credits.totalPurchased' },
            totalUsed: { $sum: '$credits.totalUsed' }
          }
        }
      ]);
      
      // Get usage by action type
      const usageByActionResult = await UsageLog.aggregate([
        {
          $match: {
            creditsUsed: { $gt: 0 } // Only count positive usage (not refunds or additions)
          }
        },
        {
          $group: {
            _id: '$action',
            totalCredits: { $sum: '$creditsUsed' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Format the results
      const totalCredits = totalCreditsResult[0] || { totalBalance: 0, totalPurchased: 0, totalUsed: 0 };
      
      const usageByAction = {};
      usageByActionResult.forEach(item => {
        usageByAction[item._id] = {
          totalCredits: item.totalCredits,
          count: item.count,
          averagePerUse: item.totalCredits / item.count
        };
      });
      
      res.status(200).json({
        success: true,
        data: {
          totalCredits,
          usageByAction
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = creditController;