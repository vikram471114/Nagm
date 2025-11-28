const mongoose = require('mongoose');

// =======================
// 1️⃣ League Model
// =======================
const LeagueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo: { type: String, default: "/uploads/default-league.png" },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const League = mongoose.model('League', LeagueSchema);

// =======================
// 2️⃣ Team Model
// =======================
const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo: { type: String, default: "/uploads/default-team.png" },
  leagueId: { type: mongoose.Schema.Types.ObjectId, ref: 'League', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Team = mongoose.model('Team', TeamSchema);

// =======================
// 3️⃣ Match Model
// =======================
const MatchSchema = new mongoose.Schema({
  leagueId: { type: mongoose.Schema.Types.ObjectId, ref: 'League', required: true },
  teamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  teamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  matchDateTime: { type: Date, required: true },
  weight: { type: Number, enum: [1, 2, 3, 6], default: 1 }, // أضفت 2 لأننا رأيناها في البيانات
  scoreA: { type: Number, default: null }, // نستخدم null للمباريات التي لم تبدأ
  scoreB: { type: Number, default: null },
  // 🛑 تصحيح الحالات لتطابق البيانات الموجودة في القاعدة
  status: { 
    type: String, 
    enum: ['Scheduled', 'Finished', 'In Progress', 'upcoming', 'finished'], // أضفت القديم والجديد للاحتياط
    default: 'Scheduled' 
  },
}, { timestamps: true });

const Match = mongoose.model('Match', MatchSchema);

// =======================
// 4️⃣ Participant Model
// =======================
const ParticipantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  fullName: { type: String, required: true },
  name: { type: String }, // حقل إضافي موجود في بعض السجلات
  phone: { type: String },
  region: { type: String },
  // حقول إضافية لضمان عدم فقدان البيانات عند التحديث
  gender: { type: String, default: 'male' },
  email: { type: String, default: '' },
  image: { type: String, default: '' },
}, { timestamps: true });

const Participant = mongoose.model('Participant', ParticipantSchema);

// =======================
// 5️⃣ Prediction Model
// =======================
const PredictionSchema = new mongoose.Schema({
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // عادة يشير لليوزر
  // 🛑 تعديل الأسماء لتطابق الكود
  scoreA: { type: Number, required: true }, 
  scoreB: { type: Number, required: true },
  pointsAwarded: { type: Number, default: 0 },
}, { timestamps: true });

const Prediction = mongoose.model('Prediction', PredictionSchema);

// =======================
// Export All Models
// =======================
module.exports = {
  League,
  Team,
  Match,
  Participant,
  Prediction
};
