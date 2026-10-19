const mongoose = require('mongoose');

const academicRolloutSchema = new mongoose.Schema({
  cycleKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  windowStart: {
    type: Date,
    required: true,
  },
  windowEnd: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'rolled_back'],
    default: 'in_progress',
  },
  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  triggeredAt: {
    type: Date,
    default: null,
  },
  promotedCount: {
    type: Number,
    default: 0,
  },
  rolledBackBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  rolledBackAt: {
    type: Date,
    default: null,
  },
  notes: {
    type: String,
    default: '',
  },
}, { timestamps: true });

const AcademicRollout = mongoose.model('AcademicRollout', academicRolloutSchema);

module.exports = AcademicRollout;
