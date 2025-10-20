const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');

require('dotenv').config();
const mongoose = require('mongoose');

// Import routes
const authRoutes = require('./routes/auth');
const interviewRoutes = require('./routes/interviews');
const userRoutes = require('./routes/users');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Make io accessible in route handlers/controllers
app.set('io', io);

const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/users', userRoutes);

// Basic route to test server
app.get('/', (req, res) => {
    res.json({
        message: "MULAKHAT Server is Running ✅",
        version: "1.0.0",
        endpoints: {
            auth: "/api/auth",
            interviews: "/api/interviews"
        }
    });
});

// Socket.io for real-time communication
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join interview room
    socket.on('join-interview', (interviewId) => {
        socket.join(interviewId);
        console.log(`User ${socket.id} joined interview ${interviewId}`);
    });

    // Leave interview room
    socket.on('leave-interview', (interviewId) => {
        socket.leave(interviewId);
        console.log(`User ${socket.id} left interview ${interviewId}`);
    });

    // Handle chat messages (persist + broadcast)
    socket.on('send-message', async (data) => {
        try {
            // dynamic import to avoid circular deps at top
            const Message = require('./models/Message');
            const saved = await Message.create({
                interviewId: data.interviewId,
                sender: data.senderId,
                message: data.message,
                messageType: data.messageType || 'text'
            });
            io.to(data.interviewId).emit('receive-message', {
                _id: saved._id,
                interviewId: data.interviewId,
                sender: data.senderId,
                message: data.message,
                messageType: saved.messageType,
                createdAt: saved.createdAt
            });
        } catch (e) {
            console.error('Failed to persist message', e.message);
        }
    });

    // Handle code changes
    socket.on('code-change', (data) => {
        socket.to(data.interviewId).emit('code-update', data);
    });

    // Handle cursor position
    socket.on('cursor-position', (data) => {
        socket.to(data.interviewId).emit('cursor-update', {
            ...data,
            userId: socket.id
        });
    });

    // Handle video call events
    socket.on('offer', (data) => {
        socket.to(data.interviewId).emit('offer', data);
    });

    socket.on('answer', (data) => {
        socket.to(data.interviewId).emit('answer', data);
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.interviewId).emit('ice-candidate', data);
    });

    // Real-time end interview event for immediate client handling
    socket.on('end-interview', (data) => {
        // Broadcast to everyone in the room (including sender to keep state consistent)
        io.to(data.interviewId).emit('interview-ended', {
            interviewId: data.interviewId,
            by: data.by || 'interviewer',
            message: 'Interview ended from interview side'
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mulakhat', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected ✅'))
.catch((err) => console.error('MongoDB connection error:', err));

// Start server
server.listen(PORT, () => {
    console.log(`🚀 MULAKHAT Server running on PORT ${PORT}`);
    console.log(`📡 Socket.io server ready for real-time communication`);
});
