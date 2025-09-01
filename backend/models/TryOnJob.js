const mongoose = require('mongoose');

const TryOnJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  modelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model',
    required: true
  },
  garmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Garment',
    required: true
  },
  sceneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scene',
    default: null
  },
  bflJobId: {
    type: String,
    required: true
  },
  pollingUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  resultUrl: {
    type: String,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  },
  prompt: {
    type: String,
    required: true
  },
  parameters: {
    type: Object,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
});

TryOnJobSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = Date.now();
  }
  next();
});

module.exports = mongoose.model('TryOnJob', TryOnJobSchema);