const Garment = require('../models/Garment');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const fs = require('fs');
const path = require('path');

/**
 * Controller for garment-related operations
 */
const garmentController = {
  /**
   * Upload a garment image
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  uploadGarment: async (req, res, next) => {
    try {
      if (!req.file) {
        return next(new AppError('No file uploaded', 400));
      }
      
      const userId = req.user.id;
      const { name, category } = req.body;
      
      if (!name) {
        return next(new AppError('Garment name is required', 400));
      }
      
      if (!category || !['top', 'bottom', 'dress', 'outerwear', 'accessory', 'footwear', 'other'].includes(category)) {
        return next(new AppError('Valid garment category is required', 400));
      }
      
      // Create file URL
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/clothes/${req.file.filename}`;
      
      // Create garment record
      const garment = new Garment({
        userId,
        name,
        url: fileUrl,
        category,
        metadata: {
          width: req.file.metadata?.width,
          height: req.file.metadata?.height,
          format: path.extname(req.file.filename).substring(1)
        }
      });
      
      await garment.save();
      
      res.status(201).json({
        success: true,
        message: 'Garment uploaded successfully',
        data: garment
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get all garments for the current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getUserGarments: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10, category } = req.query;
      
      const query = { userId };
      if (category && ['top', 'bottom', 'dress', 'outerwear', 'accessory', 'footwear', 'other'].includes(category)) {
        query.category = category;
      }
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
      };
      
      const garments = await Garment.find(query)
        .skip((options.page - 1) * options.limit)
        .limit(options.limit)
        .sort(options.sort);
      
      const total = await Garment.countDocuments(query);
      
      res.status(200).json({
        success: true,
        data: {
          garments,
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
   * Get public garments
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getPublicGarments: async (req, res, next) => {
    try {
      const { page = 1, limit = 10, category } = req.query;
      
      const query = { isPublic: true };
      if (category && ['top', 'bottom', 'dress', 'outerwear', 'accessory', 'footwear', 'other'].includes(category)) {
        query.category = category;
      }
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
      };
      
      const garments = await Garment.find(query)
        .skip((options.page - 1) * options.limit)
        .limit(options.limit)
        .sort(options.sort);
      
      const total = await Garment.countDocuments(query);
      
      res.status(200).json({
        success: true,
        data: {
          garments,
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
   * Get a specific garment by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getGarmentById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const garment = await Garment.findById(id);
      
      if (!garment) {
        return next(new AppError('Garment not found', 404));
      }
      
      // Check if user owns the garment or if it's public
      if (userId && garment.userId.toString() !== userId && !garment.isPublic) {
        return next(new AppError('You do not have permission to access this garment', 403));
      }
      
      res.status(200).json({
        success: true,
        data: garment
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Delete a garment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  deleteGarment: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const garment = await Garment.findById(id);
      
      if (!garment) {
        return next(new AppError('Garment not found', 404));
      }
      
      // Check if user owns the garment
      if (garment.userId.toString() !== userId) {
        return next(new AppError('You do not have permission to delete this garment', 403));
      }
      
      // Delete the file
      if (garment.url) {
        const filePath = garment.url.replace(`${req.protocol}://${req.get('host')}`, '');
        const fullPath = path.join(__dirname, '..', filePath);
        
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
      
      await Garment.findByIdAndDelete(id);
      
      res.status(200).json({
        success: true,
        message: 'Garment deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Update garment details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  updateGarment: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { name, category, isPublic } = req.body;
      
      const garment = await Garment.findById(id);
      
      if (!garment) {
        return next(new AppError('Garment not found', 404));
      }
      
      // Check if user owns the garment
      if (garment.userId.toString() !== userId) {
        return next(new AppError('You do not have permission to update this garment', 403));
      }
      
      // Update fields
      if (name !== undefined) garment.name = name;
      if (isPublic !== undefined) garment.isPublic = isPublic;
      if (category !== undefined && ['top', 'bottom', 'dress', 'outerwear', 'accessory', 'footwear', 'other'].includes(category)) {
        garment.category = category;
      }
      
      await garment.save();
      
      res.status(200).json({
        success: true,
        message: 'Garment updated successfully',
        data: garment
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = garmentController;