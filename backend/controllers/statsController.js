// نستخدم "require" لأن ملف models.js يستخدم "module.exports"
const { Prediction, Match, Participant } = require('../models/models.js');
const mongoose = require('mongoose');
const catchAsync = require('../utils/catchAsync');

// =======================
// وظائف مساعدة للتواريخ
// =======================
const getWeekRange = (date = new Date()) => {
    const start = new Date(date);
    const day = start.getUTCDay();
    const diff = start.getUTCDate() - day + (day === 0 ? -6 : 1);
    start.setUTCDate(diff);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    return { start, end };
};

const getDayRange = (date = new Date()) => {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 1);
    return { start, end };
};

const parseDateQuery = (query) => {
    if (query.period === 'today') {
        const { start, end } = getDayRange();
        return { start, end, periodLabel: 'اليوم' };
    }
    if (query.startDate && query.endDate) {
        const start = new Date(query.startDate);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(query.endDate);
        end.setUTCHours(23, 59, 59, 999);
        return { start, end, periodLabel: `من ${query.startDate} إلى ${query.endDate}` };
    }
    const { start, end } = getWeekRange();
    const startString = start.toISOString().split('T')[0];
    const endString = new Date(end.getTime() - 1).toISOString().split('T')[0];
    return { start, end, periodLabel: `الأسبوع الحالي (${startString} إلى ${endString})` };
};


// =======================
// الاستعلامات الرئيسية (للبطاقات)
// =======================
const getTopUsersByPoints = async (matchQuery) => {
    const results = await Prediction.aggregate([
        { $match: { pointsAwarded: { $gt: 0 }, ...matchQuery } },
        { $group: { _id: '$userId', totalPoints: { $sum: '$pointsAwarded' } } },
        { $setWindowFields: { partitionBy: null, sortBy: { totalPoints: -1 }, output: { maxPoints: { $max: "$totalPoints" } } } },
        { $match: { $expr: { $eq: ["$totalPoints", "$maxPoints"] } } },
        { $lookup: { from: 'participants', localField: '_id', foreignField: 'userId', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $match: { 'user.fullName': { $exists: true } } },
        { $project: { _id: 0, name: '$user.fullName', points: '$totalPoints' } },
        { $sort: { name: 1 } }
    ]);
    return results.length > 0 ? results : [{ name: 'لا يوجد', points: 0 }];
};

const getStarOfPeriod = (start, end) => {
    const matchQuery = { updatedAt: { $gte: start, $lt: end } };
    return getTopUsersByPoints(matchQuery);
};

const getBigMatchHunters = async (start, end) => {
    const results = await Prediction.aggregate([
        { $match: { pointsAwarded: { $gt: 0 }, updatedAt: { $gte: start, $lt: end } } },
        { $lookup: { from: 'matches', localField: 'matchId', foreignField: '_id', as: 'match' } },
        { $unwind: '$match' },
        { $match: { 'match.weight': { $in: [2, 3] } } },
        { $group: { _id: '$userId', totalPoints: { $sum: '$pointsAwarded' }, uniqueBigMatches: { $addToSet: '$matchId' } } },
        { $project: { totalPoints: 1, uniqueCount: { $size: '$uniqueBigMatches' } } },
        { $setWindowFields: { partitionBy: null, sortBy: { totalPoints: -1 }, output: { maxPoints: { $max: "$totalPoints" } } } },
        { $setWindowFields: { partitionBy: null, sortBy: { uniqueCount: -1 }, output: { maxCount: { $max: "$uniqueCount" } } } },
        { $lookup: { from: 'participants', localField: '_id', foreignField: 'userId', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $match: { 'user.fullName': { $exists: true } } },
        {
            $project: {
                _id: 0,
                name: '$user.fullName',
                points: '$totalPoints',
                count: '$uniqueCount',
                isTopPoints: { $eq: ["$totalPoints", "$maxPoints"] },
                isTopCount: { $eq: ["$uniqueCount", "$maxCount"] }
            }
        }
    ]);

    const topPointsHunters = results.filter(r => r.isTopPoints && r.points > 0).map(r => ({ name: r.name, points: r.points }));
    const topCountHunters = results.filter(r => r.isTopCount && r.count > 0).map(r => ({ name: r.name, count: r.count }));

    return {
        topPoints: topPointsHunters.length > 0 ? topPointsHunters : [{ name: 'لا يوجد', points: 0 }],
        topCount: topCountHunters.length > 0 ? topCountHunters : [{ name: 'لا يوجد', count: 0 }]
    };
};

const getHighScorers = async (start, end) => {
    const matchQuery = { updatedAt: { $gte: start, $lt: end } };
    const maxPointsResult = await Prediction.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, maxPoints: { $max: "$pointsAwarded" } } }
    ]);
    const maxPoints = maxPointsResult.length > 0 ? maxPointsResult[0].maxPoints : 0;
    if (!maxPoints || maxPoints === 0) return [{ name: 'لا يوجد', points: 0 }];

    const results = await Prediction.aggregate([
        { $match: { ...matchQuery, pointsAwarded: maxPoints } },
        { $lookup: { from: 'participants', localField: 'userId', foreignField: 'userId', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $match: { 'user.fullName': { $exists: true } } },
        { $project: { _id: 0, name: '$user.fullName', points: '$pointsAwarded' } },
        { $sort: { name: 1 } }
    ]);
    return results;
};

const getConsistencyStats = async (start, end) => {
    const matchQuery = { updatedAt: { $gte: start, $lt: end } };
    const results = await Prediction.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$userId',
                totalPredictions: { $sum: 1 },
                correctPredictions: { $sum: { $cond: [{ $gt: ['$pointsAwarded', 0] }, 1, 0] } }
            }
        },
        { $setWindowFields: { partitionBy: null, sortBy: { correctPredictions: -1 }, output: { maxCorrect: { $max: "$correctPredictions" } } } },
        { $setWindowFields: { partitionBy: null, sortBy: { totalPredictions: -1 }, output: { maxTotal: { $max: "$totalPredictions" } } } },
        { $lookup: { from: 'participants', localField: '_id', foreignField: 'userId', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $match: { 'user.fullName': { $exists: true } } },
        {
            $project: {
                _id: 0,
                name: '$user.fullName',
                correct: '$correctPredictions',
                total: '$totalPredictions',
                isTopCorrect: { $eq: ["$correctPredictions", "$maxCorrect"] },
                isTopTotal: { $eq: ["$totalPredictions", "$maxTotal"] }
            }
        }
    ]);

    const topCorrect = results.filter(r => r.isTopCorrect && r.correct > 0).map(r => ({ name: r.name, correct: r.correct }));
    const topTotal = results.filter(r => r.isTopTotal && r.total > 0).map(r => ({ name: r.name, total: r.total }));

    return {
        longestStreak: topCorrect.length > 0 ? topCorrect : [{ name: 'لا يوجد', correct: 0 }],
        mostConsistent: topTotal.length > 0 ? topTotal : [{ name: 'لا يوجد', total: 0 }]
    };
};

const getActiveStats = async (start, end) => {
    const matchQuery = { pointsAwarded: { $gt: 0 }, updatedAt: { $gte: start, $lt: end } };
    const result = await Prediction.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, totalPoints: { $sum: '$pointsAwarded' }, activeUsers: { $addToSet: '$userId' } } },
        {
            $project: {
                _id: 0,
                activeCount: { $size: '$activeUsers' },
                totalPoints: '$totalPoints',
                averagePoints: { 
                    $cond: [ { $eq: [{ $size: '$activeUsers' }, 0] }, 0, { $divide: ['$totalPoints', { $size: '$activeUsers' }] } ]
                }
            }
        }
    ]);
    if (result.length === 0) return { activeCount: 0, totalPoints: 0, averagePoints: 0 };
    result[0].averagePoints = parseFloat(result[0].averagePoints.toFixed(2));
    return result[0];
};

const getLeagueStars = async (start, end) => {
    const leagueNames = [
        "الدوري الإسباني", "الدوري الإنجليزي", "الدوري الألماني", "الدوري الفرنسي",
        "الدوري الإيطالي", "دوري أبطال أوروبا", "دوري روشن السعودي"
    ];
    const results = await Prediction.aggregate([
        { $match: { pointsAwarded: { $gt: 0 }, updatedAt: { $gte: start, $lt: end } } },
        { $lookup: { from: 'matches', localField: 'matchId', foreignField: '_id', as: 'match' } },
        { $unwind: '$match' },
        { $lookup: { from: 'leagues', localField: 'match.leagueId', foreignField: '_id', as: 'league' } },
        { $unwind: '$league' },
        { $match: { 'league.name': { $in: leagueNames } } },
        { $group: { _id: { userId: '$userId', leagueId: '$league._id', leagueName: '$league.name' }, totalPoints: { $sum: '$pointsAwarded' } } },
        { $setWindowFields: { partitionBy: "$_id.leagueId", sortBy: { totalPoints: -1 }, output: { maxPointsInLeague: { $max: "$totalPoints" } } } },
        { $match: { $expr: { $eq: ["$totalPoints", "$maxPointsInLeague"] } } },
        { $lookup: { from: 'participants', localField: '_id.userId', foreignField: 'userId', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $match: { 'user.fullName': { $exists: true } } },
        { $group: { _id: '$_id.leagueName', stars: { $push: { name: '$user.fullName', points: '$totalPoints' } } } },
        {
            $unionWith: {
                coll: 'leagues',
                pipeline: [
                    { $match: { name: { $in: leagueNames } } },
                    { $project: { _id: '$name', stars: [{ name: 'لا يوجد', points: 0 }] } }
                ]
            }
        },
        { $group: { _id: '$_id', stars: { $first: '$stars' } } },
        { $project: { league: '$_id', stars: '$stars', _id: 0 } }
    ]);
    return results;
};

// =======================
// المتحكم الرئيسي (للبطاقات)
// =======================
exports.getAllStats = catchAsync(async (req, res, next) => {
    const { start, end, periodLabel } = parseDateQuery(req.query);
    const [starsOfPeriod, bigMatchHunterStats, highScorers, consistencyStats, leagueStars] = await Promise.all([
        getStarOfPeriod(start, end),
        getBigMatchHunters(start, end),
        getHighScorers(start, end),
        getConsistencyStats(start, end),
        getLeagueStars(start, end)
    ]);
    const todayRange = getDayRange();
    const weekRange = getWeekRange();
    const [todayStats, weekStats] = await Promise.all([
        getActiveStats(todayRange.start, todayRange.end),
        getActiveStats(weekRange.start, weekRange.end)
    ]);
    const stats = {
        period: periodLabel,
        starsOfPeriod,
        bigMatchHuntersByPoints: bigMatchHunterStats.topPoints,
        bigMatchHuntersByCount: bigMatchHunterStats.topCount,
        highScorers,
        longestStreak: consistencyStats.longestStreak,
        mostConsistent: consistencyStats.mostConsistent,
        leagueStars: leagueStars.reduce((acc, item) => { acc[item.league] = item.stars; return acc; }, {}),
        activeUsersToday: todayStats.activeCount,
        activeUsersWeek: weekStats.activeCount,
        averagePointsToday: todayStats.averagePoints
    };
    res.status(200).json({ status: 'success', data: stats });
});

// =======================
// 👇👇👇 دالة تقرير المباريات (المصححة والنهائية) 👇👇👇
// =======================
exports.getMatchesStats = catchAsync(async (req, res, next) => {
    // استقبال الباراميترات (page, limit, startDate, endDate)
    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 50;
    const skip = (page - 1) * limit;
    
    const { startDate, endDate, filter } = req.query;

    // 1. إعداد فلتر البحث
    let matchQuery = {};
    
    // فلترة التاريخ (نطاق زمني)
    if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        matchQuery.matchDateTime = { $gte: start, $lte: end };
    } 
    // الفلترة حسب الحالة
    if (filter === 'finished') {
        matchQuery.status = 'Finished';
    } else if (filter === 'scheduled') {
        matchQuery.status = 'Scheduled';
    }

    // 2. جلب إجمالي العدد (للحساب الصفحات)
    const totalMatches = await Match.countDocuments(matchQuery);

    // 3. جلب المباريات (مع Pagination)
    const matches = await Match.find(matchQuery)
        .populate('teamA', 'name logo')
        .populate('teamB', 'name logo')
        .populate('leagueId', 'name')
        .sort({ matchDateTime: -1 }) // الأحدث أولاً
        .skip(skip)
        .limit(limit)
        .lean();

    // 4. جلب التوقعات والمشتركين
    const matchIds = matches.map(m => m._id);
    const allPredictions = await Prediction.find({ matchId: { $in: matchIds } }).lean();
    
    const userIds = [...new Set(allPredictions.map(p => p.userId))]; 
    const allParticipants = await Participant.find({ userId: { $in: userIds } })
        .select('userId fullName name')
        .lean();

    const participantsMap = {};
    allParticipants.forEach(p => {
        participantsMap[p.userId.toString()] = p.fullName || p.name || 'مجهول';
    });

    // 5. معالجة البيانات
    const reportData = matches.map(match => {
        const scoreA = (match.scoreA !== undefined && match.scoreA !== null) ? Number(match.scoreA) : null;
        const scoreB = (match.scoreB !== undefined && match.scoreB !== null) ? Number(match.scoreB) : null;
        
        let correctPredictorsNames = [];
        
        if (scoreA !== null && scoreB !== null) {
            const correctPreds = allPredictions.filter(p => {
                if (p.matchId.toString() !== match._id.toString()) return false;

                // 👇👇👇 الحل لمشكلة الصفر (Nullish Coalescing) 👇👇👇
                const predA = (p.predictedScoreA ?? p.scoreA); 
                const predB = (p.predictedScoreB ?? p.scoreB);

                if (predA === undefined || predA === null || predB === undefined || predB === null) return false;

                return Number(predA) === scoreA && Number(predB) === scoreB;
            });

            correctPredictorsNames = correctPreds.map(pred => {
                return participantsMap[pred.userId.toString()] || 'مجهول';
            });
        }

        return {
            id: match._id,
            league: match.leagueId ? match.leagueId.name : 'غير محدد',
            time: match.matchDateTime,
            status: match.status,
            teamA: match.teamA ? match.teamA.name : 'فريق A',
            teamB: match.teamB ? match.teamB.name : 'فريق B',
            resultFormatted: (scoreA !== null) ? `${scoreA} - ${scoreB}` : " - ",
            winnersCount: correctPredictorsNames.length,
            winnersList: correctPredictorsNames
        };
    });

    // 6. إرسال الرد
    res.status(200).json({
        status: 'success',
        results: reportData.length,
        total: totalMatches,
        currentPage: page,
        totalPages: Math.ceil(totalMatches / limit),
        data: reportData
    });
});
