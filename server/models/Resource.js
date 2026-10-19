const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  subject: {
    type:String,
    required: true,
  },
  year: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
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

const Resource = mongoose.model('Resource', resourceSchema);

module.exports = Resource;