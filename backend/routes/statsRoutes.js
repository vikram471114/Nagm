const express = require('express');
// 👇 قمنا بإضافة getMatchesStats هنا
const { getAllStats, getMatchesStats } = require('../controllers/statsController');

const router = express.Router();

// 1. الرابط الرئيسي (للبطاقات والإحصائيات العامة)
// الرابط: /api/v1/stats
router.get('/', getAllStats);

// 2. الرابط الجديد (لجدول المباريات والأسماء)
// الرابط: /api/v1/stats/matches
router.get('/matches', getMatchesStats);

module.exports = router;
