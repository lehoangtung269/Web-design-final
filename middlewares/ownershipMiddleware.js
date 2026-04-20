const Field = require('../models/Field');

const checkFieldOwnership = async (req, res, next) => {
    try {
        const field = await Field.findById(req.params.id);
        if (!field) {
            req.flash('error', 'Không tìm thấy sân!');
            return res.redirect('/admin/dashboard');
        }

        const user = req.session.user;
        // Admin toàn quyền, Owner chỉ quản lý sân của mình
        if (user.role === 'admin' || (user.role === 'field_owner' && field.owner && field.owner.toString() === user._id.toString())) {
            return next();
        }

        req.flash('error', 'Bạn không có quyền quản lý sân này!');
        res.redirect('/');
    } catch (err) {
        next(err);
    }
};

module.exports = { checkFieldOwnership };
