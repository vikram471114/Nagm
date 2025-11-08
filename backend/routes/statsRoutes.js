const express = require('express');
const { getAllStats } = require('../controllers/statsController');
// const { protect } = require('../middlewares/authMiddleware'); // (اختياري: يمكن إضافة حماية لاحقاً)

const router = express.Router();

// إنشاء رابط واحد لجلب كل الإحصائيات
// يمكن إضافة "protect" هنا إذا أردت أن تكون الصفحة محمية بكلمة مرور
router.get('/', getAllStats);

module.exports = router;