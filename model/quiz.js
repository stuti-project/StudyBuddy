const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
    question: String,
    options: [String],
    correctAnswer: String, // Store the correct answer as 'A', 'B', 'C', or 'D'
    userAnswers: [String], // Store user answers as 'A', 'B', 'C', or 'D'
    score: { type: Number, default: 0 },
    timeTaken: { type: Number, default: 0 },
    takenAt: { type: Date },
    isSubmission: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }, { timestamps: true });
  
  module.exports = mongoose.model('Quiz', quizSchema);