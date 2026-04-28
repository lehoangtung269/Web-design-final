const Service = require('../models/Service');
const BookingService = require('../models/BookingService');
const Field = require('../models/Field');
const asyncHandler = require('../middlewares/asyncHandler');

const ownerLayout = { layout: 'layouts/owner' };

// @desc    Hiển thị danh sách dịch vụ của sân
// @route   GET /owner/services
// @access  Private (Owner)
exports.getServices = asyncHandler(async (req, res) => {
    const { fieldId, search, status } = req.query;
    const ownerId = req.session.user._id;

    const fields = await Field.find({ owner: ownerId });
    const fieldIds = fields.map(f => f._id);

    let query = { field: { $in: fieldIds }, isDeleted: { $ne: true } };
    if (fieldId) query.field = fieldId;
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
        ];
    }
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;

    const services = await Service.find(query)
        .populate('field', 'name')
        .sort({ createdAt: -1 });

    const serviceStats = await BookingService.aggregate([
        { $match: { service: { $in: services.map(s => s._id) } } },
        {
            $group: {
                _id: '$service',
                totalBookings: { $sum: 1 },
                totalRevenue: { $sum: '$subtotal' },
                totalQuantity: { $sum: '$quantity' }
            }
        }
    ]);

    res.render('owner/services-index', {
        ...ownerLayout,
        title: 'Services',
        activeNav: 'services',
        services,
        fields,
        serviceStats,
        selectedField: fieldId || '',
        searchQuery: search || '',
        selectedStatus: status || ''
    });
});

// @desc    Hiển thị form tạo dịch vụ mới
// @route   GET /owner/services/create
// @access  Private (Owner)
exports.getCreateService = asyncHandler(async (req, res) => {
    const ownerId = req.session.user._id;
    const fields = await Field.find({ owner: ownerId, approvalStatus: 'approved' });

    if (fields.length === 0) {
        req.flash('error', 'Bạn cần có ít nhất 1 sân được duyệt trước khi thêm dịch vụ!');
        return res.redirect('/owner/fields');
    }

    res.render('owner/services-create', {
        ...ownerLayout,
        title: 'Add Service',
        activeNav: 'services',
        fields
    });
});

// @desc    Xử lý tạo dịch vụ mới
// @route   POST /owner/services
// @access  Private (Owner)
exports.createService = asyncHandler(async (req, res) => {
    const { name, description, price, unit, category, field, maxQuantity, isActive } = req.body;
    const ownerId = req.session.user._id;

    if (!name || !price || !field) {
        req.flash('error', 'Vui lòng điền đầy đủ thông tin bắt buộc!');
        return res.redirect('/owner/services/create');
    }

    const fieldDoc = await Field.findOne({ _id: field, owner: ownerId });
    if (!fieldDoc) {
        req.flash('error', 'Sân không tồn tại hoặc không thuộc quyền quản lý của bạn!');
        return res.redirect('back');
    }

    let imageData = {};
    if (req.cloudinaryUrl) {
        imageData = { url: req.cloudinaryUrl, publicId: req.cloudinaryPublicId || '' };
    }

    const service = await Service.create({
        name,
        description,
        price: parseFloat(price),
        unit: unit || 'suất',
        category: category || 'other',
        field,
        image: imageData,
        maxQuantity: maxQuantity ? parseInt(maxQuantity) : null,
        isActive: isActive !== 'false'
    });

    req.flash('success', `Đã thêm dịch vụ "${service.name}" thành công!`);
    res.redirect('/owner/services');
});

// @desc    Hiển thị form chỉnh sửa dịch vụ
// @route   GET /owner/services/:id/edit
// @access  Private (Owner)
exports.getEditService = asyncHandler(async (req, res) => {
    const ownerId = req.session.user._id;
    const service = await Service.findById(req.params.id).populate('field');

    if (!service) {
        req.flash('error', 'Không tìm thấy dịch vụ!');
        return res.redirect('/owner/services');
    }

    const fieldDoc = await Field.findById(service.field._id || service.field);
    if (!fieldDoc || fieldDoc.owner.toString() !== ownerId.toString()) {
        req.flash('error', 'Bạn không có quyền chỉnh sửa dịch vụ này!');
        return res.redirect('/owner/services');
    }

    const fields = await Field.find({ owner: ownerId });

    res.render('owner/services-edit', {
        ...ownerLayout,
        title: `Edit: ${service.name}`,
        activeNav: 'services',
        service,
        fields
    });
});

// @desc    Xử lý cập nhật dịch vụ
// @route   PUT /owner/services/:id
// @access  Private (Owner)
exports.updateService = asyncHandler(async (req, res) => {
    const { name, description, price, unit, category, field, maxQuantity, isActive } = req.body;
    const ownerId = req.session.user._id;

    const service = await Service.findById(req.params.id);
    if (!service) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ' });
    }

    const fieldDoc = await Field.findById(service.field);
    if (!fieldDoc || fieldDoc.owner.toString() !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    service.name = name;
    service.description = description;
    service.price = parseFloat(price);
    service.unit = unit || 'suất';
    service.category = category || 'other';
    service.field = field;
    service.maxQuantity = maxQuantity ? parseInt(maxQuantity) : null;
    service.isActive = isActive === 'true' || isActive === true;

    if (req.cloudinaryUrl) {
        service.image = { url: req.cloudinaryUrl, publicId: req.cloudinaryPublicId || '' };
    }

    await service.save();
    req.flash('success', `Đã cập nhật dịch vụ "${service.name}" thành công!`);
    res.json({ success: true, redirectTo: '/owner/services' });
});

// @desc    Xóa dịch vụ
// @route   DELETE /owner/services/:id
// @access  Private (Owner)
exports.deleteService = asyncHandler(async (req, res) => {
    const ownerId = req.session.user._id;
    const service = await Service.findById(req.params.id);

    if (!service) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ' });
    }

    const fieldDoc = await Field.findById(service.field);
    if (!fieldDoc || fieldDoc.owner.toString() !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const bookingCount = await BookingService.countDocuments({ service: service._id });
    if (bookingCount > 0) {
        service.isActive = false;
        service.isDeleted = true;
        await service.save();
        return res.json({
            success: true,
            message: 'Dịch vụ đã được ẩn vì đã có lịch sử đặt!',
            softDelete: true
        });
    }

    await Service.deleteOne({ _id: service._id });
    res.json({ success: true, message: 'Đã xóa dịch vụ thành công!' });
});

// @desc    Toggle trạng thái active/inactive
// @route   PATCH /owner/services/:id/toggle
// @access  Private (Owner)
exports.toggleServiceStatus = asyncHandler(async (req, res) => {
    const ownerId = req.session.user._id;
    const service = await Service.findById(req.params.id);

    if (!service) return res.status(404).json({ success: false });

    const fieldDoc = await Field.findById(service.field);
    if (!fieldDoc || fieldDoc.owner.toString() !== ownerId.toString()) {
        return res.status(403).json({ success: false });
    }

    service.isActive = !service.isActive;
    await service.save();

    res.json({
        success: true,
        isActive: service.isActive,
        message: service.isActive ? 'Đã kích hoạt dịch vụ' : 'Đã tắt dịch vụ'
    });
});

// @desc    API lấy thống kê dịch vụ
// @route   GET /owner/services/stats
// @access  Private (Owner)
exports.getServiceStats = asyncHandler(async (req, res) => {
    const ownerId = req.session.user._id;
    const fields = await Field.find({ owner: ownerId });
    const fieldIds = fields.map(f => f._id);

    const [totalServices, activeServices, stats] = await Promise.all([
        Service.countDocuments({ field: { $in: fieldIds }, isDeleted: { $ne: true } }),
        Service.countDocuments({ field: { $in: fieldIds }, isActive: true, isDeleted: { $ne: true } }),
        BookingService.aggregate([
            { $lookup: { from: 'services', localField: 'service', foreignField: '_id', as: 'serviceInfo' } },
            { $unwind: '$serviceInfo' },
            { $match: { 'serviceInfo.field': { $in: fieldIds } } },
            {
                $group: {
                    _id: '$service',
                    serviceName: { $first: '$serviceInfo.name' },
                    totalBookings: { $sum: 1 },
                    totalRevenue: { $sum: '$subtotal' },
                    totalQty: { $sum: '$quantity' }
                }
            },
            { $sort: { totalBookings: -1 } },
            { $limit: 10 }
        ])
    ]);

    res.json({ totalServices, activeServices, topServices: stats });
});
