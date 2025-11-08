// هذا هو الملف الذي أرسلته لي. سأستخدمه كما هو.
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
  weight: { type: Number, enum: [1, 3, 6], default: 1 },
  scoreA: { type: Number, default: 0 },
  scoreB: { type: Number, default: 0 },
  status: { type: String, enum: ['upcoming', 'in_progress', 'finished'], default: 'upcoming' },
}, { timestamps: true });

const Match = mongoose.model('Match', MatchSchema);

// =======================
// 4️⃣ Participant Model
// =======================
const ParticipantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  fullName: { type: String, required: true },
  phone: { type: String },
  region: { type: String },
}, { timestamps: true });

const Participant = mongoose.model('Participant', ParticipantSchema);

// =======================
// 5️⃣ Prediction Model
// =======================
const PredictionSchema = new mongoose.Schema({
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true },
  predictedScoreA: { type: Number, required: true },
  predictedScoreB: { type: Number, required: true },
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