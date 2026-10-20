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
  versionId: String,
  fileSize: Number,                      // bytes: the Python service needs it to read the PDF from B2
  // ---- written by the Python ingestion service ----
  status: {
    type: String,
    enum: ['queued', 'processing', 'indexed', 'failed', 'duplicate', 'skipped', 'deleting', 'cancelled'],
    default: 'queued',
    index: true,
  },
  pageCount: Number,
  pagesDone: { type: Number, default: 0 },
  failedPages: [Number],                 // pages Gemini could not read
  ingestError: String,
  waitingUntil: Date,                    // set while ingestion waits for a rate limit
  indexedAt: Date,
}, { timestamps: true });

const Resource = mongoose.model('Resource', resourceSchema);

module.exports = Resource;