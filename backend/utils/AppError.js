/**
 * هذا الملف المساعد يسمح لنا بإنشاء رسائل خطأ واضحة ومنظمة
 * يمكننا إرسالها إلى المستخدم (مثل "المباراة غير موجودة").
 */
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);

        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;