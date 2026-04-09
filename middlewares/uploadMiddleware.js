const upload = require('../config/multer');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// ================================
// Middleware: Upload ảnh sân lên Cloudinary
// Hỗ trợ tối đa 5 ảnh
// ================================
const uploadFieldImages = (req, res, next) => {
  const multerUpload = upload.array('images', 5);

  multerUpload(req, res, async (err) => {
    if (err) {
      req.flash('error', `Lỗi upload: ${err.message}`);
      return res.redirect('back');
    }

    if (!req.files || req.files.length === 0) {
      // Không có file upload → tiếp tục (không bắt buộc)
      return next();
    }

    try {
      const cloudinaryUrls = [];

      for (const file of req.files) {
        // Upload lên Cloudinary
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'football-fields',
          transformation: [
            { width: 800, height: 600, crop: 'fill', quality: 'auto' },
          ],
        });

        cloudinaryUrls.push(result.secure_url);

        // Xóa file tạm trên server
        fs.unlink(file.path, (unlinkErr) => {
          if (unlinkErr) console.error('Lỗi xóa file tạm:', unlinkErr);
        });
      }

      // Gắn danh sách URL vào request để controller dùng
      req.cloudinaryUrls = cloudinaryUrls;
      next();
    } catch (uploadError) {
      console.error('Cloudinary Upload Error:', uploadError);
      req.flash('error', 'Lỗi khi upload ảnh lên cloud!');
      return res.redirect('back');
    }
  });
};

module.exports = { uploadFieldImages };
