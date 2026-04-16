const Field = require('../models/Field');

// ================================
// GET / — Trang chủ: hiển thị sân nổi bật + thanh tìm kiếm
// ================================
const getHomePage = async (req, res) => {
  try {
    // Lấy các sân đang hoạt động
    const featuredFields = await Field.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(6);

    res.render('home/index', {
      title: 'Trang chủ - Đặt Sân Bóng Đá',
      layout: false,
      featuredFields,
    });
  } catch (error) {
    console.error('Home Error:', error);
    req.flash('error', 'Lỗi khi tải trang chủ!');
    res.render('home/index', {
      title: 'Trang chủ - Đặt Sân Bóng Đá',
      layout: false,
      featuredFields: [],
    });
  }
};

// ================================
// GET /search — Tìm kiếm / lọc sân
// Query params: date, time, type, keyword
// ================================
const searchFields = async (req, res) => {
  try {
    const { date, time, type, keyword } = req.query;

    // Xây dựng filter
    const filter = { status: 'active' };

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (keyword && keyword.trim()) {
      filter.$or = [
        { name: { $regex: keyword.trim(), $options: 'i' } },
        { address: { $regex: keyword.trim(), $options: 'i' } },
      ];
    }

    const fields = await Field.find(filter).sort({ createdAt: -1 });

    res.render('fields/list', {
      title: 'Kết quả tìm kiếm',
      layout: false,
      fields,
      searchParams: { date, time, type, keyword },
    });
  } catch (error) {
    console.error('Search Error:', error);
    req.flash('error', 'Lỗi khi tìm kiếm sân!');
    res.render('fields/list', {
      title: 'Kết quả tìm kiếm',
      layout: false,
      fields: [],
      searchParams: req.query,
    });
  }
};

module.exports = { getHomePage, searchFields };
