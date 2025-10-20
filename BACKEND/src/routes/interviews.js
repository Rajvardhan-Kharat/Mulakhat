const express = require('express');
const {
    getInterviews,
    getInterview,
    createInterview,
    updateInterview,
    startInterview,
    endInterview,
    setCurrentQuestion,
    submitCode,
    executeCode,
    runTests,
    getMessages,
    createMessage
} = require('../controllers/interviewController');

const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getInterviews)
    .post(authorize('interviewer', 'admin'), createInterview);

router.route('/:id')
    .get(getInterview)
    .put(updateInterview);

router.put('/:id/start', startInterview);
router.put('/:id/end', endInterview);
router.put('/:id/current-question', authorize('interviewer', 'admin'), setCurrentQuestion);
router.post('/:id/submit-code', submitCode);
router.post('/:id/execute', executeCode);
router.post('/:id/run-tests', runTests);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', createMessage);

module.exports = router;
