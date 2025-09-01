const mongoose = require('mongoose');

const GarmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['shirt', 'tshirt', 'pants', 'dress', 'jacket', 'sweater', 'skirt', 'other']
  },
  metadata: {
    width: Number,
    height: Number,
    format: String
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

GarmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Garment', GarmentSchema);