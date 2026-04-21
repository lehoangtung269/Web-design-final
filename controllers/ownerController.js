const Booking = require('../models/Booking');
const Field = require('../models/Field');
const TimeSlot = require('../models/TimeSlot');
const User = require('../models/User');

const ownerLayout = { layout: 'layouts/owner' };

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

        res.render('owner/bookings', { ...ownerLayout, title: 'Đơn đặt sân', bookings });
    } catch (err) {
        console.error(err);
        res.redirect('/owner/dashboard');
    }
};

exports.approveBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id).populate('field');
        if (!booking || booking.field.owner?.toString() !== req.session.user._id.toString()) {
            return res.redirect('/owner/dashboard');
        }
        if (booking.status !== 'pending') return res.redirect('/owner/bookings');

        booking.status = 'confirmed';
        await TimeSlot.findByIdAndUpdate(booking.timeSlot, { status: 'booked' });

        const field = await Field.findById(booking.field).populate('owner');
        const rate = field.owner?.commissionRate || 5;
        booking.commissionAmount = Math.round(booking.finalTotal * (rate / 100));
        booking.ownerRevenue = booking.finalTotal - booking.commissionAmount;
        booking.isRevenueCalculated = true;

        await booking.save();
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
        const booking = await Booking.findById(id).populate('field');
        if (!booking || booking.field.owner?.toString() !== req.session.user._id.toString() || booking.status !== 'pending') {
            return res.redirect('/owner/bookings');
        }
        booking.status = 'rejected';
        booking.rejectedReason = req.body.reason || 'Không đạt yêu cầu';
        await TimeSlot.findByIdAndUpdate(booking.timeSlot, { status: 'available', bookedBy: null });
        await booking.save();
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
        res.render('owner/fields', { ...ownerLayout, title: 'Sân của bạn', fields });
    } catch (err) {
        console.error(err);
        res.redirect('/owner/dashboard');
    }
};
