const Interview = require('../models/Interview');
const Question = require('../models/Question');
const User = require('../models/User');
const Message = require('../models/Message');
const axios = require('axios');

// @desc    Get all interviews
// @route   GET /api/interviews
// @access  Private
exports.getInterviews = async (req, res, next) => {
    try {
        let query = {};
        
        // Filter by role
        if (req.user.role === 'candidate') {
            query.candidate = req.user.id;
        } else if (req.user.role === 'interviewer') {
            query.interviewer = req.user.id;
        }

        const interviews = await Interview.find(query)
            .populate('interviewer', 'name email avatar')
            .populate('candidate', 'name email avatar')
            .populate('questions', 'title difficulty category')
            .sort({ scheduledAt: -1 });

        res.status(200).json({
            success: true,
            count: interviews.length,
            data: interviews
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    Get single interview
// @route   GET /api/interviews/:id
// @access  Private
exports.getInterview = async (req, res, next) => {
    try {
        const interview = await Interview.findById(req.params.id)
            .populate('interviewer', 'name email avatar')
            .populate('candidate', 'name email avatar')
            .populate('questions');

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: 'Interview not found'
            });
        }

        // Check if user has access to this interview
        if (interview.interviewer._id.toString() !== req.user.id && 
            interview.candidate._id.toString() !== req.user.id &&
            req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this interview'
            });
        }

        res.status(200).json({
            success: true,
            data: interview
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    Create new interview
// @route   POST /api/interviews
// @access  Private (Interviewer/Admin)
exports.createInterview = async (req, res, next) => {
    try {
        const { candidateId, scheduledAt, duration, questions, title, description } = req.body;

        // Verify candidate exists
        const candidate = await User.findById(candidateId);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }

        // Verify questions exist
        if (questions && questions.length > 0) {
            const questionDocs = await Question.find({ _id: { $in: questions } });
            if (questionDocs.length !== questions.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Some questions not found'
                });
            }
        }

        const interview = await Interview.create({
            title,
            description,
            interviewer: req.user.id,
            candidate: candidateId,
            scheduledAt,
            duration,
            questions
        });

        await interview.populate('interviewer', 'name email avatar');
        await interview.populate('candidate', 'name email avatar');
        await interview.populate('questions', 'title difficulty category');

        res.status(201).json({
            success: true,
            data: interview
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    Update interview
// @route   PUT /api/interviews/:id
// @access  Private
exports.updateInterview = async (req, res, next) => {
    try {
        let interview = await Interview.findById(req.params.id);

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: 'Interview not found'
            });
        }

        // Check authorization
        if (interview.interviewer.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this interview'
            });
        }

        interview = await Interview.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        })
        .populate('interviewer', 'name email avatar')
        .populate('candidate', 'name email avatar')
        .populate('questions', 'title difficulty category');

        res.status(200).json({
            success: true,
            data: interview
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    Start interview
// @route   PUT /api/interviews/:id/start
// @access  Private
exports.startInterview = async (req, res, next) => {
    try {
        const interview = await Interview.findById(req.params.id);

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: 'Interview not found'
            });
        }

        // Check authorization
        if (interview.interviewer.toString() !== req.user.id && 
            interview.candidate.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to start this interview'
            });
        }

        interview.status = 'in-progress';
        interview.startedAt = new Date();

        await interview.save();

        try {
            // Emit socket event to end interview for all participants immediately
            const io = req.app.get('io');
            if (io) {
                io.to(req.params.id).emit('interview-ended', {
                    interviewId: req.params.id,
                    by: 'interviewer',
                    message: 'Interview ended from interview side'
                });
            }
        } catch {}

        res.status(200).json({
            success: true,
            data: interview
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    End interview
// @route   PUT /api/interviews/:id/end
// @access  Private
exports.endInterview = async (req, res, next) => {
    try {
        const interview = await Interview.findById(req.params.id);

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: 'Interview not found'
            });
        }

        // Check authorization
        if (interview.interviewer.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to end this interview'
            });
        }

        interview.status = 'completed';
        interview.endedAt = new Date();

        await interview.save();

        res.status(200).json({
            success: true,
            data: interview
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    Set current question for an interview
// @route   PUT /api/interviews/:id/current-question
// @access  Private (Interviewer/Admin)
exports.setCurrentQuestion = async (req, res) => {
    try {
        const { questionId } = req.body;
        const interview = await Interview.findById(req.params.id);
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
        if (interview.interviewer.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        interview.currentQuestion = questionId || null;
        await interview.save();
        const io = req.app.get('io');
        if (io) io.to(req.params.id).emit('current-question-changed', { interviewId: req.params.id, questionId });
        return res.status(200).json({ success: true, data: { currentQuestion: interview.currentQuestion } });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Submit code for interview question
// @route   POST /api/interviews/:id/submit-code
// @access  Private
exports.submitCode = async (req, res, next) => {
    try {
        const { questionId, code, language } = req.body;

        const interview = await Interview.findById(req.params.id);

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: 'Interview not found'
            });
        }

        // Check if user is candidate
        if (interview.candidate.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Only candidate can submit code'
            });
        }

        // Find existing code submission or create new one
        let codeSubmission = interview.candidateCode.find(
            submission => submission.questionId.toString() === questionId
        );

        if (codeSubmission) {
            codeSubmission.code = code;
            codeSubmission.language = language;
            codeSubmission.submittedAt = new Date();
        } else {
            interview.candidateCode.push({
                questionId,
                code,
                language,
                submittedAt: new Date()
            });
        }

        await interview.save();

        res.status(200).json({
            success: true,
            message: 'Code submitted successfully'
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    Execute code via Judge0
// @route   POST /api/interviews/:id/execute
// @access  Private
exports.executeCode = async (req, res, next) => {
    try {
        const { source_code, language_id, stdin } = req.body;

        if (!source_code || !language_id) {
            return res.status(400).json({ success: false, message: 'Missing source_code or language_id' });
        }

        // Prefer custom URL if provided. If no API key and no custom URL, fall back to the free CE endpoint
        const useRapidApi = Boolean(process.env.JUDGE0_API_KEY);
        const baseUrl = process.env.JUDGE0_API_URL
            ? `${process.env.JUDGE0_API_URL}`
            : (useRapidApi
                ? 'https://judge0-ce.p.rapidapi.com'
                : 'https://ce.judge0.com');

        const options = {
            method: 'POST',
            url: `${baseUrl}/submissions?base64_encoded=false&wait=true`,
            headers: {
                'Content-Type': 'application/json',
                ...(useRapidApi ? { 'X-RapidAPI-Key': process.env.JUDGE0_API_KEY, 'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com' } : {})
            },
            data: {
                source_code,
                language_id,
                stdin: stdin || ''
            }
        };

        const response = await axios.request(options);
        return res.status(200).json({ success: true, data: response.data });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Run candidate code against question test cases
// @route   POST /api/interviews/:id/run-tests
// @access  Private
exports.runTests = async (req, res) => {
    try {
        const { questionId, source_code, language_id } = req.body;
        if (!questionId || !source_code || !language_id) {
            return res.status(400).json({ success: false, message: 'Missing questionId, source_code or language_id' });
        }

        const interview = await Interview.findById(req.params.id).populate('candidate');
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        // Authorization: candidate, interviewer, or admin
        if (interview.interviewer.toString() !== req.user.id && interview.candidate._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const question = await Question.findById(questionId);
        if (!question) return res.status(404).json({ success: false, message: 'Question not found' });

        const useRapidApi = Boolean(process.env.JUDGE0_API_KEY);
        const baseUrl = process.env.JUDGE0_API_URL
            ? `${process.env.JUDGE0_API_URL}`
            : (useRapidApi
                ? 'https://judge0-ce.p.rapidapi.com'
                : 'https://ce.judge0.com');

        const headers = {
            'Content-Type': 'application/json',
            ...(useRapidApi ? { 'X-RapidAPI-Key': process.env.JUDGE0_API_KEY, 'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com' } : {})
        };

        const results = [];
        for (const [index, tc] of question.testCases.entries()) {
            const payload = {
                source_code,
                language_id,
                stdin: tc.input || ''
            };
            try {
                const response = await axios.request({
                    method: 'POST',
                    url: `${baseUrl}/submissions?base64_encoded=false&wait=true`,
                    headers,
                    data: payload
                });
                const r = response.data || {};
                const stdout = r.stdout || '';
                const stderr = r.stderr || '';
                const compile_output = r.compile_output || '';
                const actual = (stdout || compile_output || stderr || '').toString().trim();
                const expected = (tc.expectedOutput || '').toString().trim();
                const passed = actual === expected;
                results.push({
                    index,
                    isHidden: !!tc.isHidden,
                    passed,
                    expected: tc.isHidden ? undefined : expected,
                    actual: tc.isHidden ? undefined : actual
                });
            } catch (err) {
                results.push({ index, isHidden: !!tc.isHidden, passed: false, error: 'Execution error' });
            }
        }

        const allPassed = results.every(r => r.passed);
        return res.status(200).json({ success: true, allPassed, results });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
// @desc    Get messages for an interview
// @route   GET /api/interviews/:id/messages
// @access  Private
exports.getMessages = async (req, res) => {
    try {
        const interviewId = req.params.id;
        const interview = await Interview.findById(interviewId);
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        if (interview.interviewer.toString() !== req.user.id && interview.candidate.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const messages = await Message.find({ interviewId }).sort({ createdAt: 1 }).populate('sender', 'name email avatar role');
        res.status(200).json({ success: true, data: messages });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Create message (used by sockets too)
// @route   POST /api/interviews/:id/messages
// @access  Private
exports.createMessage = async (req, res) => {
    try {
        const interviewId = req.params.id;
        const { message, messageType } = req.body;
        if (!message) return res.status(400).json({ success: false, message: 'Message required' });

        const interview = await Interview.findById(interviewId);
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        if (interview.interviewer.toString() !== req.user.id && interview.candidate.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const msg = await Message.create({
            interviewId,
            sender: req.user.id,
            message,
            messageType: messageType || 'text'
        });
        await msg.populate('sender', 'name email avatar role');
        res.status(201).json({ success: true, data: msg });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
