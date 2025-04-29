const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema({
    topic: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cards: [
        {
            question: { type: String, required: true },
            answer: { type: String, required: true },
            image: { type: String, default: "" },
            notes: { type: String, default: "" }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Flashcard', flashcardSchema);