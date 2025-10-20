const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please provide a question title'],
        trim: true,
        maxlength: [200, 'Title cannot be more than 200 characters']
    },
    description: {
        type: String,
        required: [true, 'Please provide question description'],
        maxlength: [2000, 'Description cannot be more than 2000 characters']
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        required: true
    },
    category: {
        type: String,
        required: [true, 'Please provide a category'],
        trim: true
    },
    tags: [{
        type: String,
        trim: true
    }],
    testCases: [{
        input: {
            type: String,
            required: true
        },
        expectedOutput: {
            type: String,
            required: true
        },
        isHidden: {
            type: Boolean,
            default: false
        }
    }],
    timeLimit: {
        type: Number,
        default: 30 // minutes
    },
    memoryLimit: {
        type: Number,
        default: 128 // MB
    },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Question', questionSchema);
