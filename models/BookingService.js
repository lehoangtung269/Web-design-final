const mongoose = require('mongoose');

const bookingServiceSchema = new mongoose.Schema({
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    name: { type: String, required: true }, // Snapshot tại thời điểm đặt
    price: { type: Number, required: true }, // Snapshot
    quantity: { type: Number, default: 1, min: 1 }
}, { timestamps: true });

module.exports = mongoose.model('BookingService', bookingServiceSchema);
