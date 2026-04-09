/**
 * upload-preview.js — Client-side preview ảnh bill chuyển khoản
 * 
 * Sử dụng trên trang checkout (bookings/checkout.ejs)
 * Chức năng:
 *   1. Preview ảnh khi chọn file
 *   2. Validate file type + file size ở client
 *   3. Drag & drop support
 */

(function () {
  'use strict';

  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('payment-image');
  const uploadPlaceholder = document.getElementById('upload-placeholder');
  const uploadPreview = document.getElementById('upload-preview');
  const previewImg = document.getElementById('preview-img');
  const fileName = document.getElementById('file-name');
  const submitBtn = document.getElementById('btn-submit');
  const checkoutForm = document.getElementById('checkout-form');

  // Config
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  if (!fileInput) return;

  // ===============================
  // Xử lý khi chọn file
  // ===============================
  fileInput.addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
      handleFile(file);
    }
  });

  // ===============================
  // Drag & Drop
  // ===============================
  if (uploadArea) {
    uploadArea.addEventListener('dragover', function (e) {
      e.preventDefault();
      this.style.borderColor = '#34d399';
      this.style.background = 'rgba(52, 211, 153, 0.05)';
    });

    uploadArea.addEventListener('dragleave', function (e) {
      e.preventDefault();
      this.style.borderColor = '';
      this.style.background = '';
    });

    uploadArea.addEventListener('drop', function (e) {
      e.preventDefault();
      this.style.borderColor = '';
      this.style.background = '';

      const file = e.dataTransfer.files[0];
      if (file) {
        // Gán file vào input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        handleFile(file);
      }
    });
  }

  // ===============================
  // Xử lý file: validate + preview
  // ===============================
  function handleFile(file) {
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('❌ Chỉ chấp nhận file ảnh (JPG, PNG, WEBP)!');
      resetUpload();
      return;
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      alert('❌ File quá lớn! Tối đa 5MB.');
      resetUpload();
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result;
      uploadPreview.classList.add('show');
      uploadPlaceholder.style.display = 'none';
      uploadArea.classList.add('has-file');
      fileName.textContent = '✅ ' + file.name + ' (' + formatFileSize(file.size) + ')';
    };
    reader.readAsDataURL(file);
  }

  // ===============================
  // Reset upload area
  // ===============================
  function resetUpload() {
    fileInput.value = '';
    previewImg.src = '';
    uploadPreview.classList.remove('show');
    uploadPlaceholder.style.display = '';
    uploadArea.classList.remove('has-file');
    fileName.textContent = '';
  }

  // ===============================
  // Format file size
  // ===============================
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ===============================
  // Form submit: hiển thị loading
  // ===============================
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', function () {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
      }
    });
  }

})();
