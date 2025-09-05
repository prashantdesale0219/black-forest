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
      console.log('Starting model generation process...');
      const { prompt, width = 1024, height = 1024, prompt_upsampling = true, seed, safety_tolerance = 2 } = req.body;
      const userId = req.user.id;
      
      // Check if user has enough credits
      const user = await User.findById(userId);
      const requiredCredits = 5; // Cost for model generation
      
      console.log(`User ${user.email || userId} has ${user.credits.balance} credits, required: ${requiredCredits}`);
      
      if (user.credits.balance < requiredCredits) {
        console.log(`User ${user.email || userId} has insufficient credits for model generation`);
        return next(new AppError('Insufficient credits for model generation', 402));
      }
      
      // Handle cloth image if provided
      let clothImageUrl = null;
      if (req.files && req.files.clothImage) {
        console.log('Received cloth image:', req.files.clothImage.name);
        const clothImage = req.files.clothImage;
        
        // Create directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../uploads/cloth_images');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Generate a unique filename
        const filename = `${Date.now()}_${clothImage.name}`;
        const clothImagePath = path.join(uploadDir, filename);
        
        try {
          // Move the uploaded file to our upload directory
          await clothImage.mv(clothImagePath);
          
          // Verify file was saved
          if (fs.existsSync(clothImagePath)) {
            console.log('Cloth image saved successfully at:', clothImagePath);
            
            // Create a URL that can be accessed by the BFL API
            const protocol = req.protocol;
            const host = req.get('host');
            clothImageUrl = `${protocol}://${host}/uploads/cloth_images/${filename}`;
            
            console.log('Cloth image URL:', clothImageUrl);
          } else {
            console.error('Failed to save cloth image: File does not exist after move operation');
          }
        } catch (error) {
          console.error('Error saving cloth image:', error);
        }
      } else if (req.body.clothImageBase64) {
        // If base64 image data is provided directly in the request body
        console.log('Using cloth image from base64 data in request body, length:', req.body.clothImageBase64.length);
        clothImageUrl = req.body.clothImageBase64;
        
        // Fix the base64 format if needed
        if (!clothImageUrl.startsWith('data:image')) {
          clothImageUrl = `data:image/jpeg;base64,${clothImageUrl}`;
          console.log('Fixed base64 format for cloth image');
          console.log(`Fixed base64 length: ${clothImageUrl.length}`);
        }
      } else {
        console.log('No cloth image provided in request');
        console.log('Request files:', req.files);
      }
      
      // Validate cloth image
      if (!clothImageUrl) {
        console.warn('No cloth image provided for model generation');
      } else {
        console.log(`Cloth image is ${clothImageUrl.startsWith('data:image') ? 'base64 data' : 'URL'} with ${clothImageUrl.startsWith('data:image') ? `length: ${clothImageUrl.length}` : `URL: ${clothImageUrl}`}`);
      }
      
      // Prepare parameters for BFL API
      // If no prompt is provided, use a default prompt for Indian model
      const defaultIndianModelPrompt = 'studio portrait of Indian female model, medium shot, plain white background, ecommerce lighting, realistic skin texture, high quality, detailed features';
      
      const params = {
        prompt: prompt || defaultIndianModelPrompt,
        width: parseInt(width),
        height: parseInt(height),
        prompt_upsampling,
        output_format: 'jpeg',
        safety_tolerance
      };
      
      // Enhance prompt for better garment application if not already specified
      if (params.prompt) {
        const originalPrompt = params.prompt;
        let enhancedPrompt = originalPrompt;
        
        // Add Indian model reference if not already specified
        if (!originalPrompt.toLowerCase().includes('indian') && !originalPrompt.toLowerCase().includes('india')) {
          enhancedPrompt = `Indian ${enhancedPrompt}`;
          console.log(`Added Indian reference to prompt: "${enhancedPrompt}"`);
        }
        
        // Add garment wearing reference if not already specified
        if (clothImageUrl && !enhancedPrompt.toLowerCase().includes('wearing') && !enhancedPrompt.toLowerCase().includes('dress')) {
          enhancedPrompt = `${enhancedPrompt}, wearing the provided garment`;
          console.log(`Added garment reference to prompt: "${enhancedPrompt}"`);
        }
        
        params.prompt = enhancedPrompt;
        console.log(`Final enhanced prompt: "${params.prompt}"`);
      } else {
        console.log(`No prompt provided`);
      }
      
      // Log request body for debugging
      console.log('Request body:', {
        ...req.body,
        clothImageBase64: req.body.clothImageBase64 ? `base64_data_present (length: ${req.body.clothImageBase64.length})` : undefined
      });
      
      // Log files for debugging
      if (req.files) {
        console.log('Request files:', Object.keys(req.files).map(key => ({
          name: key,
          filename: req.files[key].name,
          size: req.files[key].size,
          mimetype: req.files[key].mimetype,
          md5: req.files[key].md5,
          truncated: req.files[key].truncated
        })));
        
        // Log more details about clothImage if present
        if (req.files.clothImage) {
          console.log('Cloth image details:', {
            name: req.files.clothImage.name,
            size: req.files.clothImage.size,
            mimetype: req.files.clothImage.mimetype,
            md5: req.files.clothImage.md5,
            encoding: req.files.clothImage.encoding
          });
        }
      }
      
      // Add seed if provided
      if (seed) {
        params.seed = parseInt(seed);
      }
      
      // If cloth image is provided, enhance the prompt to apply it to the Indian model
      if (clothImageUrl) {
        // Add garment parameter for BFL API
        params.garment = clothImageUrl;
        
        // Enhance prompt to specify applying the garment to an Indian model
        if (!prompt || !prompt.includes('Indian')) {
          params.prompt = `${params.prompt}, wearing the provided garment, Indian ethnicity, realistic fabric texture and draping`;
        }
        
        // Check if clothImageUrl is a base64 string or a URL
        if (clothImageUrl.startsWith('data:')) {
          params.garment = clothImageUrl;
          console.log('Adding garment (base64) to params, length:', clothImageUrl.length);
        } else {
          params.garment_url = clothImageUrl;
          console.log('Adding garment_url to params:', clothImageUrl);
        }
      } else if (req.body.clothImageBase64) {
        // If no clothImageUrl but clothImageBase64 is provided in the request body
        console.log('Using clothImageBase64 from request body, length:', req.body.clothImageBase64.length);
        if (req.body.clothImageBase64.startsWith('data:')) {
          params.garment = req.body.clothImageBase64;
          console.log('Adding garment (base64) from request body, length:', req.body.clothImageBase64.length);
        } else {
          console.log('clothImageBase64 is not in correct format, trying to fix');
          // Try to fix the format if it's not properly formatted
          params.garment = `data:image/jpeg;base64,${req.body.clothImageBase64}`;
          console.log('Fixed garment base64 format, new length:', params.garment.length);
        }
      } else {
        console.log('No cloth image available for this request');
      }
      
      // Call BFL service to generate image with progress tracking
      console.log('Calling BFL service to generate image with garment application');
      
      // Create model record in database first so we can update status during processing
      const model = new Model({
        userId,
        type: 'generated',
        url: 'pending', // Will be updated when generation completes
        status: 'pending', // Set status to pending
        status_message: 'Preparing to send request to BFL API...',
        metadata: {
          width: parseInt(width),
          height: parseInt(height),
          format: 'jpeg',
          prompt,
          generationParams: params
        }
      });
      
      await model.save();
      console.log(`Created pending model record with ID: ${model._id}`);
      
      // Update model status to indicate we're sending the request
      await Model.findByIdAndUpdate(model._id, {
        status_message: 'Sending request to BFL API... This may take several minutes for large garment images.'
      });
      
      // Make the API call with error handling
      let result;
      try {
        console.log('Making BFL API call with parameters:', {
          ...params,
          garment: params.garment ? `[base64 data of length ${params.garment.length}]` : undefined
        });
        
        // Track API call duration
        const startTime = Date.now();
        
        // Make the API call
        result = await bflService.generateImage(params);
        
        const endTime = Date.now();
        const apiCallDuration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log(`BFL API call completed in ${apiCallDuration} seconds`);
        console.log('BFL API response received:', {
          ...result,
          polling_url: result.polling_url || 'No polling URL provided'
        });
        
        // Validate the response
        if (!result.polling_url) {
          throw new Error('BFL API response missing polling URL');
        }
        
        // Update model with polling URL and success status
        await Model.findByIdAndUpdate(model._id, {
          status_message: 'Request accepted by BFL API, starting image generation...',
          metadata: {
            ...model.metadata,
            apiCallDuration: apiCallDuration,
            pollingUrl: result.polling_url,
            jobId: result.id
          }
        });
        
        // Log success message for garment application
        if (clothImageUrl) {
          console.log('Successfully sent request with garment application');
        }
      } catch (apiError) {
        console.error(`Error calling BFL API: ${apiError.message}`);
        
        // Determine specific error message based on error type
        let errorMessage = `BFL API error: ${apiError.message}`;
        let statusCode = 500;
        
        // Handle specific error types
        if (apiError.message.includes('504 Gateway Timeout')) {
          errorMessage = 'BFL API Gateway Timeout: The server took too long to process your request. This usually happens with large garment images. Try with a smaller image or at a less busy time.';
          statusCode = 504;
        } else if (apiError.message.includes('timed out')) {
          errorMessage = 'BFL API request timed out: The server took too long to respond. Try with a smaller garment image or at a less busy time.';
          statusCode = 408;
        }
        
        // Update model with error status and detailed message
        await Model.findByIdAndUpdate(model._id, {
          status: 'error',
          error_message: errorMessage,
          status_message: 'Failed to generate image due to API error',
          metadata: {
            ...model.metadata,
            errorDetails: apiError.message,
            errorStatus: apiError.status || statusCode
          }
        });
        
        // Refund credits to user since we're about to deduct them
        return next(new AppError(errorMessage, statusCode));
      }
      
      // Start polling for results in background
      console.log(`Starting background process to poll for results with URL: ${result.polling_url}`);
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
      
      // Create file URL - use relative path for better compatibility with frontend
      const fileUrl = `/uploads/models/${req.file.filename}`;
      
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
    // Update model status to show it's being processed
    await Model.findByIdAndUpdate(modelId, { 
      status: 'processing',
      status_message: 'Waiting for BFL API to generate image...'
    });
    
    console.log(`Starting polling for model ID: ${modelId} with URL: ${pollingUrl}`);
    console.log('Polling may take several minutes for complex garment applications...');
    
    // Poll for results with exponential backoff
    const result = await bflService.pollWithBackoff(pollingUrl);
    
    if (result.status === 'succeeded' && result.result && result.result.sample) {
      // Update model status to show download is starting
      await Model.findByIdAndUpdate(modelId, { 
        status: 'processing',
        status_message: 'Image generated successfully, downloading...' 
      });
      
      // Download the image from the external URL and save it locally
      const fs = require('fs');
      const path = require('path');
      const axios = require('axios');
      
      // Create directory if it doesn't exist
      const uploadDir = path.join(__dirname, '../uploads/models');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`Created directory: ${uploadDir}`);
      }
      
      // Generate a unique filename
      const filename = `model_${modelId}_${Date.now()}.jpg`;
      const filePath = path.join(uploadDir, filename);
      
      try {
        console.log(`Attempting to download image from BFL API for model ${modelId}`);
        console.log(`Full result from BFL API:`, JSON.stringify(result, null, 2));
        
        // Check if result has the expected structure
        if (!result.result) {
          throw new Error(`Invalid result structure from BFL API: ${JSON.stringify(result)}`);
        }
        
        // Get the image URL from the appropriate field based on API response structure
        const imageUrl = result.result.sample || result.result.image || result.result.url;
        if (!imageUrl) {
          throw new Error(`No image URL found in BFL API response: ${JSON.stringify(result)}`);
        }
        
        console.log(`Found image URL: ${imageUrl}`);
        
        // Download the image with increased timeout
        const downloadStartTime = Date.now();
        console.log(`Starting download at: ${new Date(downloadStartTime).toISOString()}`);
        
        // Download the image
        console.log(`Making HTTP request to: ${imageUrl}`);
        const response = await axios.get(imageUrl, { 
          responseType: 'arraybuffer',
          timeout: 120000, // 120 seconds timeout (increased from 60s)
          headers: {
            'Accept': 'image/jpeg,image/png,image/*'
          },
          validateStatus: function (status) {
            return status >= 200 && status < 300; // Accept only success status codes
          }
        });
        
        const downloadEndTime = Date.now();
        const downloadTime = (downloadEndTime - downloadStartTime) / 1000;
        console.log(`Download completed in ${downloadTime.toFixed(2)} seconds`);
        
        if (!response.data || response.data.length === 0) {
          throw new Error('Downloaded image data is empty');
        }
        
        console.log(`Image download successful. Content length: ${response.headers['content-length']} bytes`);
        console.log(`Content type: ${response.headers['content-type']}`);
        
        // Write file to disk
        try {
          fs.writeFileSync(filePath, Buffer.from(response.data));
          console.log(`✅ Image successfully written to ${filePath}`);
        } catch (writeError) {
          console.error(`❌ Error writing file to disk:`, writeError);
          console.error(`Write error details: ${writeError.message}`);
          console.error(`Directory permissions: ${fs.statSync(uploadDir).mode.toString(8)}`);
          throw writeError;
        }
        
        // Verify file exists after writing
        if (!fs.existsSync(filePath)) {
          throw new Error(`File was not created at ${filePath}`);
        }
        
        const stats = fs.statSync(filePath);
        console.log(`File size: ${stats.size} bytes`);
        
        // Create a local URL for the image
        const fileUrl = `/uploads/models/${filename}`;
        console.log(`Setting model URL to: ${fileUrl}`);
        
        // Update model with local URL and set status to completed
        await Model.findByIdAndUpdate(modelId, {
          url: fileUrl,
          status: 'completed',
          status_message: 'Image generated and saved successfully',
          updatedAt: Date.now()
        });
        
        console.log(`✅ Model ${modelId} updated with local URL: ${fileUrl}`);
        console.log(`Model generation process completed successfully for ID: ${modelId}`);
      } catch (downloadError) {
        console.error(`❌ Error downloading image for model ${modelId}:`, downloadError);
        console.error(`Error details: ${downloadError.message}`);
        if (downloadError.code === 'ECONNABORTED') {
          console.error('Download timed out. The image might be too large or the server is slow.');
        }
        if (downloadError.response) {
          console.error(`Response status: ${downloadError.response.status}`);
          console.error(`Response headers:`, JSON.stringify(downloadError.response.headers));
          console.error(`Response data:`, downloadError.response.data);
        }
        throw downloadError;
      }
      
      console.log(`Model generation completed for model ${modelId}`);
    } else {
      console.error(`Model generation failed for model ${modelId}:`, result);
      
      // Determine error message
      let errorMessage = 'Model generation failed';
      if (result.failure_reason) {
        errorMessage = `Generation failed: ${result.failure_reason}`;
      } else if (result.error) {
        errorMessage = `Error: ${result.error}`;
      }
      
      // Update model with error status
      await Model.findByIdAndUpdate(modelId, {
        url: 'error',
        status: 'error',
        status_message: 'BFL API failed to generate image',
        error_message: errorMessage,
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
      status: 'error',
      status_message: 'Unexpected error during model generation process',
      error_message: error.message,
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