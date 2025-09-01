const Scene = require('../models/Scene');
const User = require('../models/User');
const UsageLog = require('../models/UsageLog');
const bflService = require('../services/bflService');
const { AppError } = require('../middleware/errorHandler');
const fs = require('fs');
const path = require('path');

/**
 * Controller for scene-related operations
 */
const sceneController = {
  /**
   * Generate a scene using BFL API
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  generateScene: async (req, res, next) => {
    try {
      const { prompt, name, domain = 'fashion', width = 1024, height = 1024, seed } = req.body;
      const userId = req.user.id;
      
      if (!prompt) {
        return next(new AppError('Prompt is required for scene generation', 400));
      }
      
      if (!name) {
        return next(new AppError('Scene name is required', 400));
      }
      
      // Check if user has enough credits
      const user = await User.findById(userId);
      const requiredCredits = 2; // Cost for scene generation
      
      if (user.credits.balance < requiredCredits) {
        return next(new AppError('Insufficient credits for scene generation', 402));
      }
      
      // Prepare parameters for BFL API
      const params = {
        prompt,
        width: parseInt(width),
        height: parseInt(height),
        prompt_upsampling: true,
        output_format: 'jpeg'
      };
      
      // Add seed if provided
      if (seed) params.seed = parseInt(seed);
      
      // Call BFL API to generate image
      const result = await bflService.generateImage(params);
      
      // Create scene record in database
      const scene = new Scene({
        userId,
        name,
        url: 'pending', // Will be updated when generation completes
        domain,
        type: 'generated',
        metadata: {
          width: parseInt(width),
          height: parseInt(height),
          format: 'jpeg',
          prompt,
          generationParams: params
        }
      });
      
      await scene.save();
      
      // Start polling for results in background
      processSceneGeneration(result.polling_url, scene._id, userId, requiredCredits);
      
      // Deduct credits from user
      user.credits.balance -= requiredCredits;
      user.credits.totalUsed += requiredCredits;
      await user.save();
      
      // Log usage
      await new UsageLog({
        userId,
        action: 'scene_change',
        creditsUsed: requiredCredits,
        jobId: result.id,
        details: { sceneId: scene._id, prompt }
      }).save();
      
      res.status(202).json({
        success: true,
        message: 'Scene generation started',
        data: {
          sceneId: scene._id,
          status: 'processing',
          jobId: result.id
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Upload a scene image
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  uploadScene: async (req, res, next) => {
    try {
      if (!req.file) {
        return next(new AppError('No file uploaded', 400));
      }
      
      const userId = req.user.id;
      const { name, domain = 'fashion' } = req.body;
      
      if (!name) {
        return next(new AppError('Scene name is required', 400));
      }
      
      // Create file URL
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/misc/${req.file.filename}`;
      
      // Create scene record
      const scene = new Scene({
        userId,
        name,
        url: fileUrl,
        domain,
        type: 'uploaded',
        metadata: {
          width: req.file.metadata?.width,
          height: req.file.metadata?.height,
          format: path.extname(req.file.filename).substring(1)
        }
      });
      
      await scene.save();
      
      res.status(201).json({
        success: true,
        message: 'Scene uploaded successfully',
        data: scene
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get all scenes for the current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getUserScenes: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10, domain, type } = req.query;
      
      const query = { userId };
      if (domain) query.domain = domain;
      if (type && ['uploaded', 'generated'].includes(type)) {
        query.type = type;
      }
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
      };
      
      const scenes = await Scene.find(query)
        .skip((options.page - 1) * options.limit)
        .limit(options.limit)
        .sort(options.sort);
      
      const total = await Scene.countDocuments(query);
      
      res.status(200).json({
        success: true,
        data: {
          scenes,
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
   * Get public scenes
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getPublicScenes: async (req, res, next) => {
    try {
      const { page = 1, limit = 10, domain } = req.query;
      
      const query = { isPublic: true };
      if (domain) query.domain = domain;
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
      };
      
      const scenes = await Scene.find(query)
        .skip((options.page - 1) * options.limit)
        .limit(options.limit)
        .sort(options.sort);
      
      const total = await Scene.countDocuments(query);
      
      res.status(200).json({
        success: true,
        data: {
          scenes,
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
   * Get a specific scene by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getSceneById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const scene = await Scene.findById(id);
      
      if (!scene) {
        return next(new AppError('Scene not found', 404));
      }
      
      // Check if user owns the scene or if it's public
      if (userId && scene.userId.toString() !== userId && !scene.isPublic) {
        return next(new AppError('You do not have permission to access this scene', 403));
      }
      
      res.status(200).json({
        success: true,
        data: scene
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Delete a scene
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  deleteScene: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const scene = await Scene.findById(id);
      
      if (!scene) {
        return next(new AppError('Scene not found', 404));
      }
      
      // Check if user owns the scene
      if (scene.userId.toString() !== userId) {
        return next(new AppError('You do not have permission to delete this scene', 403));
      }
      
      // If it's an uploaded scene, delete the file
      if (scene.type === 'uploaded' && scene.url) {
        const filePath = scene.url.replace(`${req.protocol}://${req.get('host')}`, '');
        const fullPath = path.join(__dirname, '..', filePath);
        
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
      
      await Scene.findByIdAndDelete(id);
      
      res.status(200).json({
        success: true,
        message: 'Scene deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Update scene details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  updateScene: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { name, domain, isPublic } = req.body;
      
      const scene = await Scene.findById(id);
      
      if (!scene) {
        return next(new AppError('Scene not found', 404));
      }
      
      // Check if user owns the scene
      if (scene.userId.toString() !== userId) {
        return next(new AppError('You do not have permission to update this scene', 403));
      }
      
      // Update fields
      if (name !== undefined) scene.name = name;
      if (domain !== undefined) scene.domain = domain;
      if (isPublic !== undefined) scene.isPublic = isPublic;
      
      await scene.save();
      
      res.status(200).json({
        success: true,
        message: 'Scene updated successfully',
        data: scene
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Check scene generation status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  checkGenerationStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const scene = await Scene.findById(id);
      
      if (!scene) {
        return next(new AppError('Scene not found', 404));
      }
      
      // Check if user owns the scene
      if (scene.userId.toString() !== userId) {
        return next(new AppError('You do not have permission to access this scene', 403));
      }
      
      const status = scene.url === 'pending' ? 'processing' : 'completed';
      
      res.status(200).json({
        success: true,
        data: {
          status,
          scene
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

/**
 * Process scene generation in background
 * @param {string} pollingUrl - URL to poll for results
 * @param {string} sceneId - ID of the scene in database
 * @param {string} userId - ID of the user
 * @param {number} credits - Credits used for generation
 */
async function processSceneGeneration(pollingUrl, sceneId, userId, credits) {
  try {
    // Poll for results with exponential backoff
    const result = await bflService.pollWithBackoff(pollingUrl);
    
    if (result.status === 'succeeded' && result.result && result.result.sample) {
      // Update scene with result URL
      await Scene.findByIdAndUpdate(sceneId, {
        url: result.result.sample,
        updatedAt: Date.now()
      });
      
      console.log(`Scene generation completed for scene ${sceneId}`);
    } else {
      console.error(`Scene generation failed for scene ${sceneId}:`, result);
      
      // Update scene with error status
      await Scene.findByIdAndUpdate(sceneId, {
        url: 'error',
        updatedAt: Date.now()
      });
      
      // Refund credits to user
      await User.findByIdAndUpdate(userId, {
        $inc: { 'credits.balance': credits, 'credits.totalUsed': -credits }
      });
      
      // Log error
      await new UsageLog({
        userId,
        action: 'scene_change',
        creditsUsed: -credits, // Negative to indicate refund
        jobId: result.id,
        details: { sceneId, error: 'Generation failed', result }
      }).save();
    }
  } catch (error) {
    console.error(`Error processing scene generation for scene ${sceneId}:`, error);
    
    // Update scene with error status
    await Scene.findByIdAndUpdate(sceneId, {
      url: 'error',
      updatedAt: Date.now()
    });
    
    // Refund credits to user
    await User.findByIdAndUpdate(userId, {
      $inc: { 'credits.balance': credits, 'credits.totalUsed': -credits }
    });
    
    // Log error
    await new UsageLog({
      userId,
      action: 'scene_change',
      creditsUsed: -credits, // Negative to indicate refund
      details: { sceneId, error: error.message }
    }).save();
  }
}

module.exports = sceneController;