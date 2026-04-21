const Field = require('../models/Field');

module.exports = async (req, res, next) => {
    try {
        const fieldId = req.params.id || req.params.fieldId || req.body.fieldId;
        const field = await Field.findById(fieldId);
        if (!field) {
            req.flash('error', 'Không tìm thấy sân!');
            return res.redirect('/');
        }
        const userId = req.session.user?._id?.toString();
        const isOwner = field.owner?.toString() === userId;
        const isAdmin = req.session.user?.role === 'admin';

        if (isAdmin || isOwner) {
            req.targetField = field; // Gắn vào req để controller dùng
            return next();
        }
        req.flash('error', 'Bạn không có quyền quản lý sân này!');
        res.redirect('/');
    } catch (err) { next(err); }
};
