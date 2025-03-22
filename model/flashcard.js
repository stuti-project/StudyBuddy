const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema({
    topic: { type: String, required: true },  // Topic first
    question: { type: String, required: true },
    answer: { type: String, required: true },
    notes: { type: String, default: "" }, // Optional notes field
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Flashcard', flashcardSchema);