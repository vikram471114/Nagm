const mongoose = require('mongoose');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');

// استيراد أدوات معالجة الأخطاء
const AppError = require('./utils/AppError');

// قراءة متغيرات البيئة (مثل رابط قاعدة البيانات) من ملف .env
dotenv.config({ path: './.env' });

const app = express();

// السماح للواجهة الأمامية (من أي مكان) بالوصول إلى هذا الخادم
app.use(cors());

// السماح بقراءة JSON في الطلبات
app.use(express.json());

// =======================
// 1. استيراد البوابات (Routes)
// =======================
const statsRouter = require('./routes/statsRoutes');

// =======================
// 2. استخدام البوابات
// =======================
// أي طلب يأتي إلى /api/v1/stats سيتم توجيهه إلى البوابة الخاصة بالإحصائيات
app.use('/api/v1/stats', statsRouter);

// =======================
// 3. معالجة الروابط غير الموجودة
// =======================
app.all('*', (req, res, next) => {
    next(new AppError(`لا يمكن العثور على الرابط ${req.originalUrl} على هذا الخادم!`, 404));
});

// =======================
// 4. معالج الأخطاء العام
// =======================
// أي خطأ يحدث في أي مكان في التطبيق سيتم إرساله إلى هنا
app.use((err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    console.error('ERROR 💥', err);

    res.status(err.statusCode).json({
        status: err.status,
        message: err.message || 'حدث خطأ ما',
    });
});

// =======================
// 5. الاتصال بقاعدة البيانات
// =======================
const DB = process.env.MONGODB_URI.replace(
    '<PASSWORD>',
    process.env.MONGODB_PASSWORD
);

mongoose.connect(DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('تم الاتصال بقاعدة البيانات بنجاح!'));

// =======================
// 6. تشغيل الخادم
// =======================
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`الخادم يعمل الآن على البورت ${port}...`);
});