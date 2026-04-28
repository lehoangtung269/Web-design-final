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
      // Bug 13: hiện flash message đẹp khi upload sai file type
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File quá lớn! Tối đa 5MB mỗi file.'
        : err.message || 'Lỗi upload file!';
      req.flash('error', message);
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

      // Bug 4: Xóa TẤT CẢ file tạm khi upload thất bại
      for (const file of req.files) {
        try { fs.unlinkSync(file.path); } catch (e) { }
      }

      req.flash('error', 'Lỗi upload ảnh!');
      return res.redirect('back');
    }
  });
};

// ================================
// Middleware: Upload 1 ảnh dịch vụ lên Cloudinary
// ================================
const uploadServiceImage = (req, res, next) => {
  const multerUpload = upload.single('image');

  multerUpload(req, res, async (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File quá lớn! Tối đa 5MB.'
        : err.message || 'Lỗi upload file!';
      req.flash('error', message);
      return res.redirect('back');
    }

    if (!req.file) return next(); // Không có file → tiếp tục

    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'services',
        transformation: [{ width: 600, height: 400, crop: 'fill', quality: 'auto' }]
      });

      req.cloudinaryUrl = result.secure_url;
      req.cloudinaryPublicId = result.public_id;

      fs.unlink(req.file.path, () => { });
      next();
    } catch (uploadError) {
      console.error('Cloudinary Service Upload Error:', uploadError);
      try { fs.unlinkSync(req.file.path); } catch (e) { }
      req.flash('error', 'Lỗi upload ảnh dịch vụ!');
      return res.redirect('back');
    }
  });
};

module.exports = { uploadFieldImages, uploadServiceImage };
