const TryOnJob = require('../models/TryOnJob');
const Model = require('../models/Model');
const Garment = require('../models/Garment');
const Scene = require('../models/Scene');
const User = require('../models/User');
const UsageLog = require('../models/UsageLog');
const bflService = require('../services/bflService');
const { AppError } = require('../middleware/errorHandler');

/**
 * Controller for try-on related operations
 */
const tryOnController = {
  /**
   * Create a new try-on job
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  createTryOnJob: async (req, res, next) => {
    try {
      const { modelId, garmentId, sceneId, prompt } = req.body;
      const userId = req.user.id;
      
      // Validate inputs
      if (!modelId) {
        return next(new AppError('Model ID is required', 400));
      }
      
      if (!garmentId) {
        return next(new AppError('Garment ID is required', 400));
      }
      
      // Check if user has enough credits
      const user = await User.findById(userId);
      const requiredCredits = 3; // Cost for try-on operation
      
      if (user.credits.balance < requiredCredits) {
        return next(new AppError('Insufficient credits for try-on operation', 402));
      }
      
      // Fetch model and garment
      const model = await Model.findById(modelId);
      if (!model) {
        return next(new AppError('Model not found', 404));
      }
      
      // Check if user owns the model or if it's public
      if (model.userId.toString() !== userId && !model.isPublic) {
        return next(new AppError('You do not have permission to use this model', 403));
      }
      
      const garment = await Garment.findById(garmentId);
      if (!garment) {
        return next(new AppError('Garment not found', 404));
      }
      
      // Check if user owns the garment or if it's public
      if (garment.userId.toString() !== userId && !garment.isPublic) {
        return next(new AppError('You do not have permission to use this garment', 403));
      }
      
      // Check scene if provided
      let scene = null;
      if (sceneId) {
        scene = await Scene.findById(sceneId);
        if (!scene) {
          return next(new AppError('Scene not found', 404));
        }
        
        // Check if user owns the scene or if it's public
        if (scene.userId.toString() !== userId && !scene.isPublic) {
          return next(new AppError('You do not have permission to use this scene', 403));
        }
      }
      
      // Prepare parameters for BFL API
      const params = {
        model_url: model.url,
        garment_url: garment.url,
        output_format: 'jpeg',
        // Add required parameters for BFL API - these will be converted to base64 in bflService
        image: model.url,  // Use model URL as the base image
        garment: garment.url,  // Use garment URL for the clothing item
        // Add Indian model specific parameters
        indian_model: true
      };
      
      // Add scene if provided
      if (scene) {
        params.background_url = scene.url;
      }
      
      // Add custom prompt if provided, or use default Indian model prompt
      if (prompt) {
        params.prompt = prompt;
      } else {
        // Default prompt for Indian model try-on
        params.prompt = 'Indian model wearing the provided garment, realistic fabric texture and draping, studio lighting, high quality, detailed features';
      }
      
      // Call BFL API to create try-on job
      let result;
      try {
        result = await bflService.editImage(params);
        console.log('BFL API response:', result);
        
        // Validate job ID
        if (!result || !result.id) {
          console.error('Missing job ID in BFL API response:', result);
          return next(new AppError('Invalid response from BFL API: missing job ID', 500));
        }
        
        // Validate polling URL
        if (!result.polling_url) {
          console.error('Missing polling URL in BFL API response:', result);
          return next(new AppError('Invalid response from BFL API: missing polling URL', 500));
        }
      } catch (error) {
        console.error('BFL API error:', error);
        // Include response data in error log if available
        if (error.response) {
          console.error('BFL API error response:', {
            status: error.response.status,
            data: error.response.data
          });
        }
        return next(new AppError(`Try-on service error: ${error.message}`, error.status || 500));
      }
      
      // Create try-on job record
      const tryOnJob = new TryOnJob({
        userId,
        modelId,
        garmentId,
        sceneId: scene ? scene._id : null,
        bflJobId: result.id,
        pollingUrl: result.polling_url,
        status: 'processing',
        prompt,
        parameters: params
      });
      
      await tryOnJob.save();
      
      // Start polling for results in background
      processTryOnJob(tryOnJob._id, userId, requiredCredits);
      
      // Deduct credits from user
      user.credits.balance -= requiredCredits;
      user.credits.totalUsed += requiredCredits;
      await user.save();
      
      // Log usage
      await new UsageLog({
        userId,
        action: 'tryon',
        creditsUsed: requiredCredits,
        jobId: result.id,
        details: { tryOnJobId: tryOnJob._id, modelId, garmentId, sceneId: scene?._id }
      }).save();
      
      res.status(202).json({
        success: true,
        message: 'Try-on job created successfully',
        data: {
          jobId: tryOnJob._id,
          status: tryOnJob.status,
          bflJobId: result.id
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get all try-on jobs for the current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getUserTryOnJobs: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10, status } = req.query;
      
      const query = { userId };
      if (status && ['processing', 'completed', 'failed'].includes(status)) {
        query.status = status;
      }
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
      };
      
      const tryOnJobs = await TryOnJob.find(query)
        .skip((options.page - 1) * options.limit)
        .limit(options.limit)
        .sort(options.sort)
        .populate('modelId', 'name url')
        .populate('garmentId', 'name url category')
        .populate('sceneId', 'name url');
      
      const total = await TryOnJob.countDocuments(query);
      
      res.status(200).json({
        success: true,
        data: {
          tryOnJobs,
          pagination: {
            total,
            page: options.pagem  ,
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
   * Get a specific try-on job by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getTryOnJobById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const tryOnJob = await TryOnJob.findById(id)
        .populate('modelId', 'name url')
        .populate('garmentId', 'name url category')
        .populate('sceneId', 'name url');
      
      if (!tryOnJob) {
        return next(new AppError('Try-on job not found', 404));
      }
      
      // Check if user owns the try-on job
      if (tryOnJob.userId.toString() !== userId) {
        return next(new AppError('You do not have permission to access this try-on job', 403));
      }
      
      res.status(200).json({
        success: true,
        data: tryOnJob
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Check try-on job status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  checkTryOnStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const tryOnJob = await TryOnJob.findById(id);
      
      if (!tryOnJob) {
        return next(new AppError('Try-on job not found', 404));
      }
      
      // Check if user owns the try-on job
      if (tryOnJob.userId.toString() !== userId) {
        return next(new AppError('You do not have permission to access this try-on job', 403));
      }
      
      // If job is still processing, check status from BFL API
      if (tryOnJob.status === 'processing' && tryOnJob.pollingUrl) {
        try {
          const result = await bflService.getResult(tryOnJob.pollingUrl);
          
          if (result.status === 'succeeded' && result.result && result.result.sample) {
            // Update job with result URL
            tryOnJob.resultUrl = result.result.sample;
            tryOnJob.status = 'completed';
            await tryOnJob.save();
          } else if (result.status === 'failed') {
            // Update job with error status
            tryOnJob.status = 'failed';
            tryOnJob.errorMessage = result.error || 'Try-on job failed';
            await tryOnJob.save();
            
            // Refund credits to user
            const requiredCredits = 3; // Same as when creating the job
            await User.findByIdAndUpdate(userId, {
              $inc: { 'credits.balance': requiredCredits, 'credits.totalUsed': -requiredCredits }
            });
            
            // Log refund
            await new UsageLog({
              userId,
              action: 'tryon',
              creditsUsed: -requiredCredits, // Negative to indicate refund
              jobId: tryOnJob.bflJobId,
              details: { tryOnJobId: tryOnJob._id, error: 'Try-on failed', result }
            }).save();
          }
        } catch (error) {
          console.error(`Error checking try-on job status for job ${id}:`, error);
        }
      }
      
      res.status(200).json({
        success: true,
        data: {
          status: tryOnJob.status,
          resultUrl: tryOnJob.resultUrl,
          errorMessage: tryOnJob.errorMessage
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Delete a try-on job
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  deleteTryOnJob: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const tryOnJob = await TryOnJob.findById(id);
      
      if (!tryOnJob) {
        return next(new AppError('Try-on job not found', 404));
      }
      
      // Check if user owns the try-on job
      if (tryOnJob.userId.toString() !== userId) {
        return next(new AppError('You do not have permission to delete this try-on job', 403));
      }
      
      await TryOnJob.findByIdAndDelete(id);
      
      res.status(200).json({
        success: true,
        message: 'Try-on job deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
};

/**
 * Process try-on job in background
 * @param {string} jobId - ID of the try-on job
 * @param {string} userId - ID of the user
 * @param {number} credits - Credits used for the job
 */
async function processTryOnJob(jobId, userId, credits) {
  try {
    const tryOnJob = await TryOnJob.findById(jobId);
    
    if (!tryOnJob) {
      console.error(`Try-on job not found for ID ${jobId}`);
      return;
    }
    
    if (!tryOnJob.pollingUrl) {
      console.error(`Missing polling URL for job ${jobId}`);
      tryOnJob.status = 'failed';
      tryOnJob.errorMessage = 'Missing polling URL';
      await tryOnJob.save();
      await refundCredits(userId, credits, jobId, 'Missing polling URL');
      return;
    }
    
    console.log(`Processing try-on job ${jobId} with polling URL: ${tryOnJob.pollingUrl}`);
    
    // Poll for results with exponential backoff
    let result;
    try {
      result = await bflService.pollWithBackoff(tryOnJob.pollingUrl);
      console.log(`Poll result for job ${jobId}:`, result);
    } catch (error) {
      console.error(`Polling error for job ${jobId}:`, error);
      tryOnJob.status = 'failed';
      tryOnJob.errorMessage = `Polling error: ${error.message}`;
      await tryOnJob.save();
      await refundCredits(userId, credits, jobId, error.message);
      return;
    }
    
    if (result.status === 'succeeded' && result.result && result.result.sample) {
      // Update job with result URL
      tryOnJob.resultUrl = result.result.sample;
      tryOnJob.status = 'completed';
      await tryOnJob.save();
      
      console.log(`Try-on job completed for job ${jobId}`);
    } else {
      console.error(`Try-on job failed for job ${jobId}:`, result);
      
      // Update job with error status
      tryOnJob.status = 'failed';
      tryOnJob.errorMessage = result.error || 'Try-on job failed';
      await tryOnJob.save();
      
      // Refund credits to user
      await User.findByIdAndUpdate(userId, {
        $inc: { 'credits.balance': credits, 'credits.totalUsed': -credits }
      });
      
      // Log refund
      await new UsageLog({
        userId,
        action: 'tryon',
        creditsUsed: -credits, // Negative to indicate refund
        jobId: tryOnJob.bflJobId,
        details: { tryOnJobId: jobId, error: 'Try-on failed', result }
      }).save();
    }
  } catch (error) {
    console.error(`Error processing try-on job for job ${jobId}:`, error);
    
    try {
      // Update job with error status
      await TryOnJob.findByIdAndUpdate(jobId, {
        status: 'failed',
        errorMessage: `Processing error: ${error.message}`
      });
      
      // Refund credits to user
      await User.findByIdAndUpdate(userId, {
        $inc: { 'credits.balance': credits, 'credits.totalUsed': -credits }
      });
      
      // Log refund
      await new UsageLog({
        userId,
        action: 'tryon',
        creditsUsed: -credits, // Negative to indicate refund
        details: { tryOnJobId: jobId, error: error.message }
      }).save();
    } catch (innerError) {
      console.error(`Error updating failed try-on job ${jobId}:`, innerError);
    }
  }
}

/**
 * Helper function to refund credits to user
 * @param {string} userId - User ID
 * @param {number} credits - Credits to refund
 * @param {string} jobId - Job ID
 * @param {string} errorMessage - Error message
 */
async function refundCredits(userId, credits, jobId, errorMessage) {
  try {
    // Refund credits to user
    await User.findByIdAndUpdate(userId, {
      $inc: { 'credits.balance': credits, 'credits.totalUsed': -credits }
    });
    
    // Log refund
    await new UsageLog({
      userId,
      action: 'tryon_refund',
      creditsUsed: -credits, // Negative to indicate refund
      jobId: jobId,
      details: { tryOnJobId: jobId, error: errorMessage }
    }).save();
    
    console.log(`Refunded ${credits} credits to user ${userId} for job ${jobId}`);
  } catch (error) {
    console.error(`Failed to refund credits for job ${jobId}:`, error);
  }
}

module.exports = tryOnController;