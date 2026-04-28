const Booking = require('../models/Booking');
const Field = require('../models/Field');
const TimeSlot = require('../models/TimeSlot');
const User = require('../models/User');
const { sendBookingConfirmationAsync } = require('../utils/emailService');
const { APPROVAL_STATUS, getEffectiveApprovalStatus } = require('../utils/fieldApproval');

const ownerLayout = { layout: 'layouts/owner' };

const SLOT_WINDOWS = [
  { startTime: '06:00', endTime: '07:30' },
  { startTime: '07:30', endTime: '09:00' },
  { startTime: '09:00', endTime: '10:30' },
  { startTime: '10:30', endTime: '12:00' },
  { startTime: '12:00', endTime: '13:30' },
  { startTime: '13:30', endTime: '15:00' },
  { startTime: '15:00', endTime: '16:30' },
  { startTime: '16:30', endTime: '18:00' },
  { startTime: '18:00', endTime: '19:30' },
  { startTime: '19:30', endTime: '21:00' },
  { startTime: '21:00', endTime: '22:30' },
];

function getBookingAmount(booking) {
  return booking?.finalTotal ?? booking?.totalPrice ?? 0;
}

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getStartOfWeek(date = new Date()) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const dayOfWeek = target.getDay();
  const diffToMonday = target.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  target.setDate(diffToMonday);

  return target;
}

function getOwnerManagedFieldScope(ownerId) {
  return {
    owner: ownerId,
    status: { $ne: 'deleted' },
  };
}

function getOwnerVisibleFieldScope(ownerId) {
  return {
    ...getOwnerManagedFieldScope(ownerId),
    approvalStatus: { $ne: APPROVAL_STATUS.REJECTED },
  };
}

function summarizeFieldApprovals(fields) {
  return fields.reduce(
    (acc, field) => {
      const approvalStatus = getEffectiveApprovalStatus(field);
      acc.total += 1;

      if (field.status === 'active' && approvalStatus === APPROVAL_STATUS.APPROVED) {
        acc.live += 1;
      }
      if (approvalStatus === APPROVAL_STATUS.PENDING) {
        acc.pending += 1;
      }
      if (approvalStatus === APPROVAL_STATUS.REJECTED) {
        acc.rejected += 1;
      }

      return acc;
    },
    { total: 0, live: 0, pending: 0, rejected: 0 }
  );
}

async function getFreshOwnerName(ownerId, fallbackName) {
  const freshOwner = await User.findById(ownerId).select('name').lean();
  return freshOwner?.name || fallbackName || 'Chủ sân';
}

exports.getDashboard = async (req, res) => {
  try {
    const ownerId = req.session.user._id;
    const [fields, allOwnerFields] = await Promise.all([
      Field.find(getOwnerVisibleFieldScope(ownerId))
        .sort({ createdAt: -1 })
        .limit(6),
      Field.find(getOwnerManagedFieldScope(ownerId)).select('_id status approvalStatus'),
    ]);

    const visibleOwnerFields = allOwnerFields.filter(
      (field) => getEffectiveApprovalStatus(field) !== APPROVAL_STATUS.REJECTED
    );
    const rejectedNotificationCount = allOwnerFields.length - visibleOwnerFields.length;
    const allFieldIds = allOwnerFields.map((field) => field._id);

    // Chart: 7-day booking trends for owner's fields
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [pendingBookings, confirmedBookings, totalRevenue, recentBookings, ownerName, bookingTrendsAgg] = await Promise.all([
      Booking.countDocuments({ field: { $in: allFieldIds }, status: 'pending' }),
      Booking.countDocuments({ field: { $in: allFieldIds }, status: 'confirmed' }),
      Booking.aggregate([
        { $match: { field: { $in: allFieldIds }, status: 'confirmed' } },
        { $group: { _id: null, sum: { $sum: '$ownerRevenue' } } },
      ]),
      Booking.find({ field: { $in: allFieldIds } })
        .populate('user', 'name phone')
        .populate('field', 'name')
        .sort({ createdAt: -1 })
        .limit(6),
      getFreshOwnerName(ownerId, req.session.user?.name),
      Booking.aggregate([
        { $match: { field: { $in: allFieldIds }, date: { $gte: sevenDaysAgo, $lte: today } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Ho_Chi_Minh' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Build chart data
    const chartData = [];
    let maxBookings = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dateStr = toLocalDateString(d);
      const match = bookingTrendsAgg.find((item) => item._id === dateStr);
      const count = match ? match.count : 0;
      maxBookings = Math.max(maxBookings, count);
      chartData.push({
        date: dateStr,
        shortLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
        fullLabel: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        count,
      });
    }
    const peakDay = chartData.reduce(
      (best, item) => (item.count > best.count ? item : best),
      chartData[0] || { shortLabel: '--', count: 0 }
    );

    const fieldSummary = summarizeFieldApprovals(visibleOwnerFields);

    res.render('owner/dashboard', {
      ...ownerLayout,
      title: 'Bảng điều khiển chủ sân',
      activeNav: 'owner-dashboard',
      ownerName,
      stats: {
        totalFields: fieldSummary.total,
        liveFields: fieldSummary.live,
        pendingFieldApprovals: fieldSummary.pending,
        pendingBookings,
        confirmedBookings,
        revenue: totalRevenue[0]?.sum || 0,
        notificationCount: rejectedNotificationCount,
        rejectedFieldApprovals: rejectedNotificationCount,
      },
      ownedFields: fields,
      recentBookings,
      chartData,
      maxBookings: maxBookings || 1,
      peakDay,
    });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
};

exports.getBookings = async (req, res) => {
  try {
    const ownerId = req.session.user._id;
    const fields = await Field.find(getOwnerManagedFieldScope(ownerId)).select('_id');
    const fieldIds = fields.map((field) => field._id);

    const bookings = await Booking.find({ field: { $in: fieldIds } })
      .populate('user', 'name phone')
      .populate('field', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

    res.render('owner/bookings', {
      ...ownerLayout,
      title: 'Đơn đặt sân',
      activeNav: 'bookings',
      bookings,
    });
  } catch (err) {
    console.error(err);
    res.redirect('/owner/dashboard');
  }
};

exports.getBookingDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('user', 'name email phone')
      .populate('field', 'name address city district type pricePerSlot images owner');

    if (!booking || booking.field?.owner?.toString() !== req.session.user._id.toString()) {
      req.flash('error', 'Không tìm thấy đơn đặt sân của bạn.');
      return res.redirect('/owner/bookings');
    }

    return res.render('owner/booking-detail', {
      ...ownerLayout,
      title: 'Chi tiết đơn đặt sân',
      activeNav: 'bookings',
      booking,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Không thể tải chi tiết đơn lúc này.');
    return res.redirect('/owner/bookings');
  }
};

exports.getSchedule = async (req, res) => {
  try {
    const ownerId = req.session.user._id;
    const requestedFieldId = req.query.fieldId || 'all';
    const baseDate = req.query.date ? parseLocalDate(req.query.date) : new Date();
    const startOfWeek = getStartOfWeek(baseDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const prevWeek = new Date(startOfWeek);
    prevWeek.setDate(startOfWeek.getDate() - 7);

    const nextWeek = new Date(startOfWeek);
    nextWeek.setDate(startOfWeek.getDate() + 7);

    const ownerFields = await Field.find(getOwnerVisibleFieldScope(ownerId))
      .select('_id name status type approvalStatus approvalNote')
      .sort({ name: 1 });

    const selectedField = requestedFieldId !== 'all'
      ? ownerFields.find((field) => field._id.toString() === requestedFieldId) || null
      : null;
    const selectedFieldId = selectedField ? selectedField._id.toString() : 'all';

    const bookingFilter = {
      field: { $in: ownerFields.map((field) => field._id) },
      date: { $gte: startOfWeek, $lte: endOfWeek },
    };
    if (selectedField) {
      bookingFilter.field = selectedField._id;
    }

    const bookings = await Booking.find(bookingFilter)
      .populate('field', 'name type')
      .populate('user', 'name phone')
      .sort({ date: 1, startTime: 1 });

    const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const todayKey = toLocalDateString(new Date());
    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + index);

      return {
        name: dayLabels[index],
        dateNum: currentDate.getDate(),
        fullDateStr: toLocalDateString(currentDate),
        isToday: toLocalDateString(currentDate) === todayKey,
      };
    });

    const bookingMap = new Map();
    bookings.forEach((booking) => {
      const key = `${toLocalDateString(new Date(booking.date))}_${booking.startTime}`;
      if (!bookingMap.has(key)) {
        bookingMap.set(key, []);
      }
      bookingMap.get(key).push(booking);
    });

    const scheduleRows = SLOT_WINDOWS.map((slot) => ({
      ...slot,
      cells: weekDays.map((day) => ({
        date: day.fullDateStr,
        bookings: bookingMap.get(`${day.fullDateStr}_${slot.startTime}`) || [],
      })),
    }));

    const monthNames = ['Thg 1', 'Thg 2', 'Thg 3', 'Thg 4', 'Thg 5', 'Thg 6', 'Thg 7', 'Thg 8', 'Thg 9', 'Thg 10', 'Thg 11', 'Thg 12'];
    let weekTitle = `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()}`;
    weekTitle += startOfWeek.getMonth() === endOfWeek.getMonth()
      ? ` — ${endOfWeek.getDate()}`
      : ` — ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getDate()}`;

    // Day view support (#17)
    const scheduleViewMode = req.query.view === 'day' ? 'day' : 'week';
    const baseDateClamped = new Date(baseDate);
    baseDateClamped.setHours(0, 0, 0, 0);

    // Find the index of the selected day within the week (0=MON ... 6=SUN)
    let dayViewIndex = 0;
    const baseDateStr = toLocalDateString(baseDateClamped);
    for (let i = 0; i < weekDays.length; i++) {
      if (weekDays[i].fullDateStr === baseDateStr) {
        dayViewIndex = i;
        break;
      }
    }

    // Prev/Next day strings
    const prevDay = new Date(baseDateClamped);
    prevDay.setDate(baseDateClamped.getDate() - 1);
    const nextDay = new Date(baseDateClamped);
    nextDay.setDate(baseDateClamped.getDate() + 1);

    // Day title (e.g. "Thứ 2, 28 Thg 4")
    const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayTitle = `${dayNames[baseDateClamped.getDay()]}, ${baseDateClamped.getDate()} ${monthNames[baseDateClamped.getMonth()]}`;

    res.render('owner/schedule', {
      ...ownerLayout,
      title: 'Lịch sân',
      activeNav: 'schedule',
      fieldOptions: ownerFields,
      selectedField,
      selectedFieldId,
      weekTitle,
      weekDays,
      scheduleRows,
      currentDateStr: toLocalDateString(baseDate),
      prevWeekStr: toLocalDateString(prevWeek),
      nextWeekStr: toLocalDateString(nextWeek),
      todayStr: toLocalDateString(new Date()),
      scheduleViewMode,
      dayViewIndex,
      prevDayStr: toLocalDateString(prevDay),
      nextDayStr: toLocalDateString(nextDay),
      dayTitle,
      weekStats: {
        total: bookings.length,
        confirmed: bookings.filter((booking) => booking.status === 'confirmed').length,
        pending: bookings.filter((booking) => booking.status === 'pending').length,
        rejected: bookings.filter((booking) => ['rejected', 'cancelled'].includes(booking.status)).length,
      },
    });
  } catch (err) {
    console.error(err);
    res.redirect('/owner/dashboard');
  }
};

exports.blockTimeSlot = async (req, res) => {
  try {
    const { fieldId, date, startTime, endTime, redirectDate, redirectView } = req.body;
    const ownerId = req.session.user._id;

    // Verify field ownership
    const field = await Field.findOne({ _id: fieldId, owner: ownerId, status: { $ne: 'deleted' } });
    if (!field) {
      req.flash('error', 'Không tìm thấy sân của bạn.');
      return res.redirect('/owner/schedule');
    }

    const slotDate = parseLocalDate(date);

    // Find or create the slot, then block it
    let slot = await TimeSlot.findOne({ field: fieldId, date: slotDate, startTime });
    if (slot) {
      if (slot.status === 'booked') {
        req.flash('error', 'Slot này đã có người đặt, không thể chặn.');
        return res.redirect(`/owner/schedule?date=${redirectDate || date}&fieldId=${fieldId}&view=${redirectView || 'day'}`);
      }
      slot.status = 'blocked';
      slot.bookedBy = null;
      await slot.save();
    } else {
      await TimeSlot.create({
        field: fieldId,
        date: slotDate,
        startTime,
        endTime,
        status: 'blocked',
      });
    }

    req.flash('success', `Đã chặn slot ${startTime} - ${endTime} ngày ${date}.`);
    res.redirect(`/owner/schedule?date=${redirectDate || date}&fieldId=${fieldId}&view=${redirectView || 'day'}`);
  } catch (err) {
    console.error('Block Time Slot Error:', err);
    req.flash('error', 'Không thể chặn slot lúc này.');
    res.redirect('/owner/schedule');
  }
};

exports.approveBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id)
      .populate('field')
      .populate('user', 'name email');

    if (!booking || booking.field.owner?.toString() !== req.session.user._id.toString()) {
      req.flash('error', 'Không tìm thấy đơn đặt sân của bạn.');
      return res.redirect('/owner/bookings');
    }
    if (booking.status !== 'pending') {
      req.flash('error', 'Đơn này đã được xử lý rồi.');
      return res.redirect(`/owner/bookings/${id}`);
    }

    booking.status = 'confirmed';
    booking.approvedBy = req.session.user._id;
    booking.approvedAt = new Date();
    await TimeSlot.findByIdAndUpdate(booking.timeSlot, {
      status: 'booked',
      bookedBy: booking.user,
    });

    const field = await Field.findById(booking.field._id).populate('owner');
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
    res.redirect(`/owner/bookings/${id}`);
  } catch (e) {
    console.error(e);
    req.flash('error', 'Không thể duyệt đơn lúc này.');
    res.redirect(`/owner/bookings/${req.params.id}`);
  }
};

exports.rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id)
      .populate('field')
      .populate('user', 'name email');

    if (!booking || booking.field.owner?.toString() !== req.session.user._id.toString()) {
      req.flash('error', 'Không tìm thấy đơn đặt sân của bạn.');
      return res.redirect('/owner/bookings');
    }

    if (booking.status !== 'pending') {
      req.flash('error', 'Đơn này đã được xử lý rồi.');
      return res.redirect(`/owner/bookings/${id}`);
    }

    booking.status = 'rejected';
    booking.rejectedReason = req.body.reason?.trim() || 'Không đạt yêu cầu';
    booking.approvedBy = req.session.user._id;
    booking.approvedAt = new Date();
    await TimeSlot.findByIdAndUpdate(booking.timeSlot, {
      status: 'available',
      bookedBy: null,
    });
    await booking.save();

    if (booking.user?.email) {
      await sendBookingConfirmationAsync(booking.user.email, booking);
    }

    req.flash('success', 'Đã từ chối đơn!');
    res.redirect(`/owner/bookings/${id}`);
  } catch (e) {
    console.error(e);
    req.flash('error', 'Không thể từ chối đơn lúc này.');
    res.redirect(`/owner/bookings/${req.params.id}`);
  }
};

exports.getFields = async (req, res) => {
  try {
    const [fields, notificationCount] = await Promise.all([
      Field.find(getOwnerVisibleFieldScope(req.session.user._id)).sort({ createdAt: -1 }),
      Field.countDocuments({
        ...getOwnerManagedFieldScope(req.session.user._id),
        approvalStatus: APPROVAL_STATUS.REJECTED,
      }),
    ]);
    const stats = summarizeFieldApprovals(fields);

    res.render('owner/fields', {
      ...ownerLayout,
      title: 'Sân của bạn',
      activeNav: 'fields',
      fields,
      stats,
      notificationCount,
    });
  } catch (err) {
    console.error(err);
    res.redirect('/owner/dashboard');
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Field.find({
      ...getOwnerManagedFieldScope(req.session.user._id),
      approvalStatus: APPROVAL_STATUS.REJECTED,
    })
      .select('_id name address city district type approvalNote approvedAt updatedAt')
      .sort({ approvedAt: -1, updatedAt: -1 });

    res.render('owner/notifications', {
      ...ownerLayout,
      title: 'Thông báo',
      activeNav: 'notifications',
      notifications,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Không thể tải thông báo lúc này.');
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
      approvalStatus: APPROVAL_STATUS.PENDING,
      approvalNote: 'Chờ admin duyệt sân mới từ cổng chủ sân.',
      approvedBy: null,
      approvedAt: null,
      submittedByOwner: true,
    });

    req.flash('success', 'Đã gửi sân mới lên hệ thống. Sân sẽ hiển thị công khai sau khi admin duyệt.');
    res.redirect('/owner/fields');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Không thể tạo sân lúc này.');
    res.redirect('/owner/fields/create');
  }
};

exports.showEditField = async (req, res) => {
  try {
    const field = await Field.findOne({
      _id: req.params.id,
      ...getOwnerManagedFieldScope(req.session.user._id),
    });

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

    const field = await Field.findOne({
      _id: req.params.id,
      ...getOwnerManagedFieldScope(req.session.user._id),
    });

    if (!field) {
      req.flash('error', 'Không tìm thấy sân của bạn.');
      return res.redirect('/owner/fields');
    }

    const facilitiesArr = Array.isArray(facilities) ? facilities : facilities ? [facilities] : [];
    field.name = name;
    field.address = address;
    field.city = city;
    field.district = district;
    field.type = type;
    field.pricePerSlot = pricePerSlot;
    field.description = description;
    field.status = ['active', 'maintenance'].includes(status) ? status : field.status;
    field.facilities = facilitiesArr;

    if (req.cloudinaryUrls && req.cloudinaryUrls.length > 0) {
      field.images = req.cloudinaryUrls;
    }

    if (getEffectiveApprovalStatus(field) !== APPROVAL_STATUS.APPROVED) {
      field.approvalStatus = APPROVAL_STATUS.PENDING;
      field.approvalNote = 'Chủ sân đã cập nhật hồ sơ và gửi lại để admin duyệt.';
      field.approvedBy = null;
      field.approvedAt = null;
      field.submittedByOwner = true;
    }

    await field.save();

    req.flash(
      'success',
      getEffectiveApprovalStatus(field) === APPROVAL_STATUS.PENDING
        ? 'Đã cập nhật sân và gửi lại để admin duyệt.'
        : 'Cập nhật sân thành công!'
    );
    res.redirect('/owner/fields');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Không thể cập nhật sân lúc này.');
    res.redirect(`/owner/fields/${req.params.id}/edit`);
  }
};

exports.getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).select('-password');
    res.render('owner/settings', {
      ...ownerLayout,
      activeNav: 'settings',
      title: 'Cài đặt tài khoản',
      pageTitle: 'Cài đặt tài khoản',
      user,
    });
  } catch (error) {
    console.error('Lỗi lấy settings:', error);
    req.flash('error', 'Lỗi tải trang cài đặt!');
    res.redirect('/owner/dashboard');
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { name, phone, bankName, accountNumber, accountName } = req.body;

    await User.findByIdAndUpdate(req.session.user._id, {
      name,
      phone,
      bankInfo: {
        bankName,
        accountNumber,
        accountName,
      }
    });

    req.session.user.name = name; // Update session
    req.flash('success', 'Đã cập nhật thông tin thành công!');
    res.redirect('/owner/settings');
  } catch (error) {
    console.error('Lỗi update settings:', error);
    req.flash('error', 'Không thể lưu cài đặt. Vui lòng thử lại!');
    res.redirect('/owner/settings');
  }
};

exports.uploadQR = async (req, res) => {
  try {
    if (!req.cloudinaryUrl) {
      req.flash('error', 'Vui lòng chọn ảnh QR để tải lên!');
      return res.redirect('/owner/settings');
    }

    const updateData = {
      paymentQR: {
        url: req.cloudinaryUrl,
        publicId: req.cloudinaryPublicId
      }
    };

    await User.findByIdAndUpdate(req.session.user._id, updateData, { new: true });

    req.flash('success', 'Đã tải lên QR code thanh toán thành công!');
    res.redirect('/owner/settings');
  } catch (error) {
    console.error('Lỗi upload QR settings:', error);
    req.flash('error', 'Chưa lưu được ảnh QR!');
    res.redirect('/owner/settings');
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      req.flash('error', 'Mật khẩu mới không khớp!');
      return res.redirect('/owner/settings');
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      req.flash('error', 'Không tìm thấy tài khoản!');
      return res.redirect('/owner/settings');
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      req.flash('error', 'Mật khẩu hiện tại không đúng!');
      return res.redirect('/owner/settings');
    }

    user.password = newPassword; // Will be hashed by pre-save hook
    await user.save();

    req.flash('success', 'Đổi mật khẩu thành công!');
    res.redirect('/owner/settings');
  } catch (error) {
    console.error('Lỗi đổi mật khẩu:', error);
    req.flash('error', 'Không thể đổi mật khẩu!');
    res.redirect('/owner/settings');
  }
};
