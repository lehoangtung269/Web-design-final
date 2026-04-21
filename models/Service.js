const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: ['lần', 'giờ', 'bộ', 'chai'], default: 'lần' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
