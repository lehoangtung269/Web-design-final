const Booking = require('../models/Booking');

/**
 * Sinh mã đặt sân độc nhất — Format: DS-YYYYMMDD-XXXX
 * Ví dụ: DS-20250428-A7F3
 */
const generateBookingCode = async () => {
    const today = new Date();
    const ymd = today.toISOString().slice(0, 10).replace(/-/g, ''); // 20250428

    let code;
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 10) {
        const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
        code = `DS-${ymd}-${rand}`;
        exists = !!(await Booking.findOne({ bookingCode: code }).select('_id').lean());
        attempts++;
    }

    return code;
};

module.exports = { generateBookingCode };
