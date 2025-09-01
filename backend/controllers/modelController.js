const Model = require('../models/Model');
const User = require('../models/User');
const UsageLog = require('../models/UsageLog');
const bflService = require('../services/bflService');
const { AppError } = require('../middleware/errorHandler');
const fs = require('fs');
const path = require('path');

/**
 * Controller for model-related operations
 */
const modelController = {
  /**
   * Generate a model using BFL API
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  generateModel: async (req, res, next) => {
    try {
      const { prompt, width = 1024, height = 1024, prompt_upsampling = true, seed, safety_tolerance = 2 } = req.body;
      const userId = req.user.id;
      
      // Check if user has enough credits
      const user = await User.findById(userId);
      const requiredCredits = 5; // Cost for model generation
      
      if (user.credits.balance < requiredCredits) {
        return next(new AppError('Insufficient credits for model generation', 402));
      }
      
      // Prepare parameters for BFL API
      const params = {
        prompt,
        width: parseInt(width),
        height: parseInt(height),
        prompt_upsampling,
        output_format: 'jpeg',
        safety_tolerance
      };
      
      // Add seed if provided
      if (seed) params.seed = parseInt(seed);
      
      // Call BFL API to generate image
      const result = await bflService.generateImage(params);
      
      // Create model record in database
      const model = new Model({
        userId,
        type: 'generated',
        url: 'pending', // Will be updated when generation completes
        metadata: {
          width: parseInt(width),
          height: parseInt(height),
          format: 'jpeg',
          prompt,
          generationParams: params
        }
      });
      
      await model.save();
      
      // Start polling for results in background
      processModelGeneration(result.polling_url, model._id, userId, requiredCredits);
      
      // Deduct credits from user
      user.credits.balance -= requiredCredits;
      user.credits.totalUsed += requiredCredits;
      await user.save();
      
      // Log usage
      await new UsageLog({
        userId,
        action: 'model_generation',
        creditsUsed: requiredCredits,
        jobId: result.id,
        details: { modelId: model._id, prompt }
      }).save();
      
      res.status(202).json({
        success: true,
        message: 'Model generation started',
        data: {
          modelId: model._id,
          status: 'processing',
          jobId: result.id
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get all models for the current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getUserModels: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10, type } = req.query;
      
      const query = { userId };
      if (type && ['uploaded', 'generated'].includes(type)) {
        query.type = type;
      }
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
      };
      
      const models = await Model.find(query)
        .skip((options.page - 1) * options.limit)
        .limit(options.limit)
        .sort(options.sort);
      
      const total = await Model.countDocuments(query);
      
      res.status(200).json({
        success: true,
        data: {
          models,
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
   * Get a specific model by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getModelById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const model = await Model.findById(id);
      
      if (!model) {
        return next(new AppError('Model not found', 404));
      }
      
      // Check if user owns the model or if it's public
      if (model.userId.toString() !== userId && !model.isPublic) {
        return next(new AppError('You do not have permission to access this model', 403));
      }
      
      res.status(200).json({
        success: true,
        data: model
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Upload a model image
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  uploadModel: async (req, res, next) => {
    try {
      if (!req.file) {
        return next(new AppError('No file uploaded', 400));
      }
      
      const userId = req.user.id;
      const { name } = req.body;
      
      // Create file URL
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/models/${req.file.filename}`;
      
      // Create model record
      const model = new Model({
        userId,
        type: 'uploaded',
        url: fileUrl,
        name: name || 'Uploaded Model',
        metadata: {
          width: req.file.metadata?.width,
          height: req.file.metadata?.height,
          format: path.extname(req.file.filename).substring(1)
        }
      });
      
      await model.save();
      
      res.status(201).json({
        success: true,
        message: 'Model uploaded successfully',
        data: model
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Delete a model
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  deleteModel: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const model = await Model.findById(id);
      
      if (!model) {
        return next(new AppError('Model not found', 404));
      }
      
      // Check if user owns the model
      if (model.userId.toString() !== userId) {
        return next(new AppError('You do not have permission to delete this model', 403));
      }
      
      // If it's an uploaded model, delete the file
      if (model.type === 'uploaded' && model.url) {
        const filePath = model.url.replace(`${req.protocol}://${req.get('host')}`, '');
        const fullPath = path.join(__dirname, '..', filePath);
        
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
      
      await Model.findByIdAndDelete(id);
      
      res.status(200).json({
        success: true,
        message: 'Model deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Update model details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  updateModel: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { name, isPublic } = req.body;
      
      const model = await Model.findById(id);
      
      if (!model) {
        return next(new AppError('Model not found', 404));
      }
      
      // Check if user owns the model
      if (model.userId.toString() !== userId) {
        return next(new AppError('You do not have permission to update this model', 403));
      }
      
      // Update fields
      if (name !== undefined) model.name = name;
      if (isPublic !== undefined) model.isPublic = isPublic;
      
      await model.save();
      
      res.status(200).json({
        success: true,
        message: 'Model updated successfully',
        data: model
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Check model generation status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  checkGenerationStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const model = await Model.findById(id);
      
      if (!model) {
        return next(new AppError('Model not found', 404));
      }
      
      // Check if user owns the model
      if (model.userId.toString() !== userId) {
        return next(new AppError('You do not have permission to access this model', 403));
      }
      
      const status = model.url === 'pending' ? 'processing' : 'completed';
      
      res.status(200).json({
        success: true,
        data: {
          status,
          model
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

/**
 * Process model generation in background
 * @param {string} pollingUrl - URL to poll for results
 * @param {string} modelId - ID of the model in database
 * @param {string} userId - ID of the user
 * @param {number} credits - Credits used for generation
 */
async function processModelGeneration(pollingUrl, modelId, userId, credits) {
  try {
    // Poll for results with exponential backoff
    const result = await bflService.pollWithBackoff(pollingUrl);
    
    if (result.status === 'succeeded' && result.result && result.result.sample) {
      // Update model with result URL
      await Model.findByIdAndUpdate(modelId, {
        url: result.result.sample,
        updatedAt: Date.now()
      });
      
      console.log(`Model generation completed for model ${modelId}`);
    } else {
      console.error(`Model generation failed for model ${modelId}:`, result);
      
      // Update model with error status
      await Model.findByIdAndUpdate(modelId, {
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
        action: 'model_generation',
        creditsUsed: -credits, // Negative to indicate refund
        jobId: result.id,
        details: { modelId, error: 'Generation failed', result }
      }).save();
    }
  } catch (error) {
    console.error(`Error processing model generation for model ${modelId}:`, error);
    
    // Update model with error status
    await Model.findByIdAndUpdate(modelId, {
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
      action: 'model_generation',
      creditsUsed: -credits, // Negative to indicate refund
      details: { modelId, error: error.message }
    }).save();
  }
}

module.exports = modelController;