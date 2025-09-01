const mongoose = require('mongoose');

const UsageLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['model_generation', 'tryon', 'scene_change', 'other'],
    required: true
  },
  creditsUsed: {
    type: Number,
    required: true
  },
  jobId: {
    type: String,
    default: null
  },
  details: {
    type: Object,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('UsageLog', UsageLogSchema);