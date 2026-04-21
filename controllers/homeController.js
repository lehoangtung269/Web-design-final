const Field = require('../models/Field');
const { escapeRegex } = require('../utils/escapeRegex');

const normalizeSearchParams = (query = {}) => ({
  date: query.date || '',
  time: query.time || '',
  type: query.type || 'all',
  keyword: query.keyword ? query.keyword.trim() : '',
  city: query.city || 'all',
  district: query.district || 'all',
});

const getResultMeta = (fields, searchParams) => {
  const prices = fields.map((item) => item.pricePerSlot).filter((price) => Number.isFinite(price));
  const cityCount = new Set(fields.map((item) => item.city).filter(Boolean)).size;

  const activeFilterCount = [
    searchParams.keyword,
    searchParams.date,
    searchParams.time,
    searchParams.type !== 'all' ? searchParams.type : '',
    searchParams.city !== 'all' ? searchParams.city : '',
    searchParams.district !== 'all' ? searchParams.district : '',
  ].filter(Boolean).length;

  return {
    total: fields.length,
    cityCount,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    activeFilterCount,
  };
};

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
    const searchParams = normalizeSearchParams(req.query);
    const { type, keyword, city, district } = searchParams;

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

    if (keyword) {
      const safeKeyword = escapeRegex(keyword);
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

    const resultMeta = getResultMeta(fields, searchParams);

    res.render('fields/list', {
      title: 'Kết quả tìm kiếm',
      activeNav: 'fields',
      viewMode: 'search',
      fields,
      cities: cityAgg.filter(Boolean).sort(),
      districts: districtAgg.filter(Boolean).sort(),
      searchParams,
      resultMeta,
    });
  } catch (error) {
    console.error('Search Error:', error);
    const searchParams = normalizeSearchParams(req.query);
    req.flash('error', 'Lỗi khi tìm kiếm sân!');
    res.render('fields/list', {
      title: 'Kết quả tìm kiếm',
      activeNav: 'fields',
      viewMode: 'search',
      fields: [],
      cities: [],
      districts: [],
      searchParams,
      resultMeta: getResultMeta([], searchParams),
    });
  }
};

module.exports = { getHomePage, searchFields };
