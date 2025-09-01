const mongoose = require('mongoose');

const PromptConfigSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: true,
    unique: true,
    enum: ['fashion', 'interior', 'other']
  },
  promptText: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

PromptConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PromptConfig', PromptConfigSchema);