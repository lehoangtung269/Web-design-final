const Booking = require('../models/Booking');
const Field = require('../models/Field');
const TimeSlot = require('../models/TimeSlot');
const User = require('../models/User');
const { sendBookingConfirmationAsync } = require('../utils/emailService');

const ownerLayout = { layout: 'layouts/owner' };

function getBookingAmount(booking) {
    return booking?.finalTotal ?? booking?.totalPrice ?? 0;
}

exports.getDashboard = async (req, res) => {
    try {
        const ownerId = req.session.user._id;
        const fields = await Field.find({ owner: ownerId }).select('_id');
        const fieldIds = fields.map(f => f._id);

        const [totalFields, pendingBookings, confirmedBookings, totalRevenue] = await Promise.all([
            Field.countDocuments({ owner: ownerId }),
            Booking.countDocuments({ field: { $in: fieldIds }, status: 'pending' }),
            Booking.countDocuments({ field: { $in: fieldIds }, status: 'confirmed' }),
            Booking.aggregate([
                { $match: { field: { $in: fieldIds }, status: 'confirmed' } },
                { $group: { _id: null, sum: { $sum: '$ownerRevenue' } } }
            ])
        ]);

        const recentBookings = await Booking.find({ field: { $in: fieldIds } })
            .populate('user', 'name phone')
            .populate('field', 'name')
            .sort({ createdAt: -1 })
            .limit(5);

        res.render('owner/dashboard', {
            ...ownerLayout,
            title: 'Chủ sân Dashboard',
            activeNav: 'owner-dashboard',
            stats: {
                totalFields,
                pendingBookings,
                confirmedBookings,
                revenue: totalRevenue[0]?.sum || 0
            },
            recentBookings
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
};

exports.getBookings = async (req, res) => {
    try {
        const ownerId = req.session.user._id;
        const fields = await Field.find({ owner: ownerId }).select('_id');
        const fieldIds = fields.map(f => f._id);

        const bookings = await Booking.find({ field: { $in: fieldIds } })
            .populate('user', 'name phone')
            .populate('field', 'name')
            .sort({ createdAt: -1 })
            .limit(20);

        res.render('owner/bookings', { ...ownerLayout, title: 'Đơn đặt sân', activeNav: 'bookings', bookings });
    } catch (err) {
        console.error(err);
        res.redirect('/owner/dashboard');
    }
};

exports.approveBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id).populate('field').populate('user', 'name email');
        if (!booking || booking.field.owner?.toString() !== req.session.user._id.toString()) {
            return res.redirect('/owner/dashboard');
        }
        if (booking.status !== 'pending') return res.redirect('/owner/bookings');

        booking.status = 'confirmed';
        await TimeSlot.findByIdAndUpdate(booking.timeSlot, { status: 'booked' });

        const field = await Field.findById(booking.field).populate('owner');
        const rate = field.owner?.commissionRate || 5;
        const bookingAmount = getBookingAmount(booking);
        booking.finalTotal = bookingAmount;
        booking.commissionAmount = Math.round(bookingAmount * (rate / 100));
        booking.ownerRevenue = bookingAmount - booking.commissionAmount;
        booking.isRevenueCalculated = true;

        await booking.save();
        if (booking.user?.email) {
            await sendBookingConfirmationAsync(booking.user.email, booking);
        }
        req.flash('success', 'Đã duyệt đơn!');
        res.redirect('/owner/bookings');
    } catch (e) {
        console.error(e);
        res.redirect('/owner/bookings');
    }
};

exports.rejectBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id).populate('field').populate('user', 'name email');
        if (!booking || booking.field.owner?.toString() !== req.session.user._id.toString() || booking.status !== 'pending') {
            return res.redirect('/owner/bookings');
        }
        booking.status = 'rejected';
        booking.rejectedReason = req.body.reason || 'Không đạt yêu cầu';
        await TimeSlot.findByIdAndUpdate(booking.timeSlot, { status: 'available', bookedBy: null });
        await booking.save();
        if (booking.user?.email) {
            await sendBookingConfirmationAsync(booking.user.email, booking);
        }
        req.flash('warning', 'Đã từ chối đơn!');
        res.redirect('/owner/bookings');
    } catch (e) {
        console.error(e);
        res.redirect('/owner/bookings');
    }
};

exports.getFields = async (req, res) => {
    try {
        const fields = await Field.find({ owner: req.session.user._id }).sort({ createdAt: -1 });
        res.render('owner/fields', { ...ownerLayout, title: 'Sân của bạn', activeNav: 'fields', fields });
    } catch (err) {
        console.error(err);
        res.redirect('/owner/dashboard');
    }
};

exports.showCreateField = async (req, res) => {
    try {
        res.render('owner/fields-create', {
            ...ownerLayout,
            title: 'Thêm sân mới',
            activeNav: 'fields',
        });
    } catch (err) {
        console.error(err);
        res.redirect('/owner/fields');
    }
};

exports.createField = async (req, res) => {
    try {
        const { name, address, city, district, type, pricePerSlot, description, facilities } = req.body || {};
        if (!name || !address || !city || !district || !type || !pricePerSlot) {
            req.flash('error', 'Vui lòng điền đầy đủ thông tin bắt buộc.');
            return res.redirect('/owner/fields/create');
        }

        const facilitiesArr = Array.isArray(facilities) ? facilities : facilities ? [facilities] : [];
        await Field.create({
            name,
            address,
            city,
            district,
            type,
            pricePerSlot,
            description,
            facilities: facilitiesArr,
            owner: req.session.user._id,
            images: req.cloudinaryUrls || [],
            status: 'active',
        });

        req.flash('success', 'Đã tạo sân mới thành công!');
        res.redirect('/owner/fields');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Không thể tạo sân lúc này.');
        res.redirect('/owner/fields/create');
    }
};

exports.showEditField = async (req, res) => {
    try {
        const field = await Field.findOne({ _id: req.params.id, owner: req.session.user._id });
        if (!field) {
            req.flash('error', 'Không tìm thấy sân của bạn.');
            return res.redirect('/owner/fields');
        }

        res.render('owner/fields-edit', {
            ...ownerLayout,
            title: 'Sửa sân',
            activeNav: 'fields',
            field,
        });
    } catch (err) {
        console.error(err);
        res.redirect('/owner/fields');
    }
};

exports.updateField = async (req, res) => {
    try {
        const { name, address, city, district, type, pricePerSlot, description, status, facilities } = req.body || {};
        if (!name || !address || !city || !district || !type || !pricePerSlot) {
            req.flash('error', 'Vui lòng điền đầy đủ thông tin.');
            return res.redirect(`/owner/fields/${req.params.id}/edit`);
        }

        const facilitiesArr = Array.isArray(facilities) ? facilities : facilities ? [facilities] : [];
        const updateData = {
            name,
            address,
            city,
            district,
            type,
            pricePerSlot,
            description,
            status,
            facilities: facilitiesArr,
        };
        if (req.cloudinaryUrls && req.cloudinaryUrls.length > 0) {
            updateData.images = req.cloudinaryUrls;
        }

        const updated = await Field.findOneAndUpdate(
            { _id: req.params.id, owner: req.session.user._id },
            updateData,
            { new: true, runValidators: true }
        );
        if (!updated) {
            req.flash('error', 'Không tìm thấy sân của bạn.');
            return res.redirect('/owner/fields');
        }

        req.flash('success', 'Cập nhật sân thành công!');
        res.redirect('/owner/fields');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Không thể cập nhật sân lúc này.');
        res.redirect(`/owner/fields/${req.params.id}/edit`);
    }
};
