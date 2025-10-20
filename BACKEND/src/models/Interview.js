const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please provide interview title'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    description: {
        type: String,
        maxlength: [500, 'Description cannot be more than 500 characters']
    },
    interviewer: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    candidate: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    scheduledAt: {
        type: Date,
        required: [true, 'Please provide scheduled time']
    },
    duration: {
        type: Number,
        required: true,
        default: 60 // minutes
    },
    status: {
        type: String,
        enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    questions: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Question'
    }],
    currentQuestion: {
        type: mongoose.Schema.ObjectId,
        ref: 'Question'
    },
    roomId: {
        type: String,
        unique: true
    },
    startedAt: Date,
    endedAt: Date,
    feedback: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comments: String,
        strengths: [String],
        improvements: [String]
    },
    candidateCode: [{
        questionId: {
            type: mongoose.Schema.ObjectId,
            ref: 'Question'
        },
        code: String,
        language: String,
        submittedAt: Date,
        testResults: [{
            testCaseId: String,
            passed: Boolean,
            output: String,
            runtime: Number
        }]
    }]
}, {
    timestamps: true
});

// Generate unique room ID
interviewSchema.pre('save', function(next) {
    if (!this.roomId) {
        this.roomId = `room_${this._id}_${Date.now()}`;
    }
    next();
});

module.exports = mongoose.model('Interview', interviewSchema);
