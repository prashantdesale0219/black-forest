const mongoose = require('mongoose');

const ModelSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['uploaded', 'generated'],
    required: true
  },
  url: {
    type: String,
    required: true
  },
  metadata: {
    width: Number,
    height: Number,
    format: String,
    prompt: String,
    generationParams: Object
  },
  isPublic: {
    type: Boolean,
    default: false
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

ModelSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Model', ModelSchema);