const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  flashcardsCompleted: { type: Number, default: 0 },
  quizzesTaken: { type: Number, default: 0 },
  totalQuizScore: { type: Number, default: 0 },  // New
  totalTimeSpent: { type: Number, default: 0 },  // New
  tasksCompleted: { type: Number, default: 0 },
  currentTopic: { type: String, default: '' },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Progress', progressSchema);
