const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    interviewId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Interview',
        required: true
    },
    sender: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: [true, 'Message cannot be empty'],
        maxlength: [1000, 'Message cannot be more than 1000 characters']
    },
    messageType: {
        type: String,
        enum: ['text', 'code', 'system'],
        default: 'text'
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);
