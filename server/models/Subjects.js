const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const subjectSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    year: {
        type: Number,
        required: true,
    },
    category: {
        type: String,
        enum: ['core', 'optional'],
        required: true,
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, { timestamps: true });

const Subject = mongoose.model('Subject', subjectSchema);
module.exports = Subject;