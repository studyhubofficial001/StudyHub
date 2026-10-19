const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: function(){return !this.googleId;},
    },
    googleId: {
        type:String,
        required: function(){return !this.password;},
        default: null
    },
    role:{
        type: String,
        enum: ['student', 'admin'],
        default: 'student',
    },
    verified: {
        type: Boolean,
        default: false,
    },
    otp: {
        type: String,
        default: null,
    },
    otpPurpose: {
        type: String,
        enum: ['verification', 'email-change', 'password-reset', null],
        default: null,
    },
    otpExpiration: {
        type: Date,
        default: null,
    },
    pendingEmail: {
        type: String,
        default: null,
    },
    passwordUpdatedAt: {
        type: Date,
        default: Date.now,
    },
    year:{
        type: Number,
        default: null,
    },
    lastYearPromotionCycle: {
        type: String,
        default: null,
    },
    lastYearPromotionAt: {
        type: Date,
        default: null,
    },
    lastYearPromotionBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    isProfileComplete: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

module.exports = User;