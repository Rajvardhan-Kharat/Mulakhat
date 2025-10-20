const User = require('../models/User');

// @desc    List users (optionally by role, search by name/email)
// @route   GET /api/users
// @access  Private (Interviewer/Admin)
exports.listUsers = async (req, res) => {
    try {
        const { role, q, limit = 20 } = req.query;
        const filter = {};
        if (role) filter.role = role;
        if (q) {
            filter.$or = [
                { name: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } }
            ];
        }
        const users = await User.find(filter).select('name email role avatar').limit(Number(limit));
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


