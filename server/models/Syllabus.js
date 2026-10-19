const mongoose = require('mongoose');

const syllabusSchema = new mongoose.Schema({
  fileKey: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  fileHash: {
    type: String,
    unique: true,
    index: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

const Syllabus = mongoose.model('Syllabus', syllabusSchema);

module.exports = Syllabus;
