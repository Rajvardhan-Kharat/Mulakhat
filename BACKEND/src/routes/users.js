const express = require('express');
const { listUsers } = require('../controllers/userController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);
router.get('/', authorize('interviewer', 'admin'), listUsers);

module.exports = router;


