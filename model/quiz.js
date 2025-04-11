const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
    question: String,
    options: [String],
    correctAnswer: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);
