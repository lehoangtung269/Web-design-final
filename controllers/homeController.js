const Field = require('../models/Field');
const { escapeRegex } = require('../utils/escapeRegex');

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
      activeNav: 'home',
      featuredFields,
    });
  } catch (error) {
    console.error('Home Error:', error);
    req.flash('error', 'Lỗi khi tải trang chủ!');
    res.render('home/index', {
      title: 'Trang chủ - Đặt Sân Bóng Đá',
      activeNav: 'home',
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
    const { date, time, type, keyword, city, district } = req.query;

    // Xây dựng filter
    const filter = { status: 'active' };

    if (type && type !== 'all') {
      filter.type = type;
    }
    if (city && city !== 'all') {
      filter.city = city;
    }
    if (district && district !== 'all') {
      filter.district = district;
    }

    if (keyword && keyword.trim()) {
      const safeKeyword = escapeRegex(keyword.trim());
      filter.$or = [
        { name: { $regex: safeKeyword, $options: 'i' } },
        { address: { $regex: safeKeyword, $options: 'i' } },
      ];
    }

    const [fields, cityAgg, districtAgg] = await Promise.all([
      Field.find(filter).sort({ createdAt: -1 }),
      Field.distinct('city', { status: 'active' }),
      Field.distinct('district', { status: 'active' }),
    ]);

    res.render('fields/list', {
      title: 'Kết quả tìm kiếm',
      activeNav: 'fields',
      fields,
      cities: cityAgg.filter(Boolean).sort(),
      districts: districtAgg.filter(Boolean).sort(),
      searchParams: { date, time, type, keyword, city, district },
    });
  } catch (error) {
    console.error('Search Error:', error);
    req.flash('error', 'Lỗi khi tìm kiếm sân!');
    res.render('fields/list', {
      title: 'Kết quả tìm kiếm',
      activeNav: 'fields',
      fields: [],
      cities: [],
      districts: [],
      searchParams: req.query,
    });
  }
};

module.exports = { getHomePage, searchFields };
