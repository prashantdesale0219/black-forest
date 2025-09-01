const PromptConfig = require('../models/PromptConfig');
const { AppError } = require('../middleware/errorHandler');

/**
 * Controller for prompt configuration operations
 */
const promptConfigController = {
  /**
   * Create a new prompt configuration
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  createPromptConfig: async (req, res, next) => {
    try {
      // Only admin can create prompt configs
      if (req.user.role !== 'admin') {
        return next(new AppError('You do not have permission to create prompt configurations', 403));
      }
      
      const { domain, promptText, description, isActive = true } = req.body;
      
      if (!domain) {
        return next(new AppError('Domain is required', 400));
      }
      
      if (!promptText) {
        return next(new AppError('Prompt text is required', 400));
      }
      
      // Check if a prompt config already exists for this domain
      const existingConfig = await PromptConfig.findOne({ domain });
      
      if (existingConfig) {
        return next(new AppError(`A prompt configuration already exists for domain: ${domain}`, 400));
      }
      
      // Create new prompt config
      const promptConfig = new PromptConfig({
        domain,
        promptText,
        description,
        isActive
      });
      
      await promptConfig.save();
      
      res.status(201).json({
        success: true,
        message: 'Prompt configuration created successfully',
        data: promptConfig
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get all prompt configurations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getAllPromptConfigs: async (req, res, next) => {
    try {
      const { active } = req.query;
      
      const query = {};
      if (active === 'true') {
        query.isActive = true;
      } else if (active === 'false') {
        query.isActive = false;
      }
      
      const promptConfigs = await PromptConfig.find(query).sort({ domain: 1 });
      
      res.status(200).json({
        success: true,
        data: promptConfigs
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get a prompt configuration by domain
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getPromptConfigByDomain: async (req, res, next) => {
    try {
      const { domain } = req.params;
      
      const promptConfig = await PromptConfig.findOne({ domain });
      
      if (!promptConfig) {
        return next(new AppError(`No prompt configuration found for domain: ${domain}`, 404));
      }
      
      res.status(200).json({
        success: true,
        data: promptConfig
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Update a prompt configuration
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  updatePromptConfig: async (req, res, next) => {
    try {
      // Only admin can update prompt configs
      if (req.user.role !== 'admin') {
        return next(new AppError('You do not have permission to update prompt configurations', 403));
      }
      
      const { domain } = req.params;
      const { promptText, description, isActive } = req.body;
      
      const promptConfig = await PromptConfig.findOne({ domain });
      
      if (!promptConfig) {
        return next(new AppError(`No prompt configuration found for domain: ${domain}`, 404));
      }
      
      // Update fields
      if (promptText !== undefined) promptConfig.promptText = promptText;
      if (description !== undefined) promptConfig.description = description;
      if (isActive !== undefined) promptConfig.isActive = isActive;
      
      await promptConfig.save();
      
      res.status(200).json({
        success: true,
        message: 'Prompt configuration updated successfully',
        data: promptConfig
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Delete a prompt configuration
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  deletePromptConfig: async (req, res, next) => {
    try {
      // Only admin can delete prompt configs
      if (req.user.role !== 'admin') {
        return next(new AppError('You do not have permission to delete prompt configurations', 403));
      }
      
      const { domain } = req.params;
      
      const promptConfig = await PromptConfig.findOne({ domain });
      
      if (!promptConfig) {
        return next(new AppError(`No prompt configuration found for domain: ${domain}`, 404));
      }
      
      await PromptConfig.findOneAndDelete({ domain });
      
      res.status(200).json({
        success: true,
        message: 'Prompt configuration deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = promptConfigController;