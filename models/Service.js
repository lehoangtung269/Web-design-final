const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, default: 'suất' },
    category: {
        type: String,
        enum: ['beverage', 'equipment', 'rental', 'food', 'other'],
        default: 'other'
    },
    image: {
        url: { type: String },
        publicId: { type: String }
    },
    maxQuantity: { type: Number, min: 1, default: null },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
