const Flashcard = require('../model/flashcard');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Helper function to process text into flashcards
function generateFlashcards(text) {
    const lines = text.split("\n").filter(line => line.trim() !== "");
    const flashcards = [];

    for (let i = 0; i < lines.length - 1; i += 2) {
        flashcards.push({
            topic: "Generated Topic",
            question: lines[i].trim(),
            answer: lines[i + 1].trim(),
            notes: "",
        });
    }

    return flashcards;
}

// Extract text from files
async function extractTextFromFile(filePath, mimetype) {
    if (mimetype === "application/pdf") {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const dataBuffer = fs.readFileSync(filePath);
        const { value } = await mammoth.extractRawText({ buffer: dataBuffer });
        return value;
    } else if (mimetype === "text/plain") {
        return fs.readFileSync(filePath, "utf8");
    }
    throw new Error("Unsupported file type");
}

// Create Flashcard (Manual & File Upload)
module.exports.createFlashcard = async (req, res) => {
    const userId = req.user._id;
    let flashcards = [];

    try {
        // Check if file is uploaded
        if (req.file) {
            const filePath = req.file.path;
            const fileType = req.file.mimetype;

            const extractedText = await extractTextFromFile(filePath, fileType);
            flashcards = generateFlashcards(extractedText);

            // Delete the file after processing
            fs.unlinkSync(filePath);
        } else {
            flashcards = Array.isArray(req.body) ? req.body : [req.body]; // Manual creation
        }

        // Ensure at least 2 flashcards
        if (flashcards.length < 2) {
            return res.status(400).json({ error: "You must create at least 2 flashcards." });
        }

        // Validate each flashcard
        for (const card of flashcards) {
            if (!card.topic || !card.question || !card.answer) {
                return res.status(400).json({ error: "Topic, question, and answer are required." });
            }
        }

        // Insert flashcards into database
        const createdFlashcards = await Flashcard.insertMany(
            flashcards.map(card => ({
                ...card,
                createdBy: userId
            }))
        );

        res.status(201).json({
            message: `${createdFlashcards.length} flashcard(s) created successfully!`,
            flashcards: createdFlashcards
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


module.exports.updateFlashcard = async (req, res) => {
    const { flashcardId } = req.params;
    const { topic, question, answer, notes } = req.body;

    try {
        const flashcard = await Flashcard.findById(flashcardId);

        if (!flashcard) {
            return res.status(404).json({ error: "Flashcard not found" });
        }

        if (flashcard.createdBy.toString() !== req.user._id) {
            return res.status(403).json({ error: "You are not authorized to update this flashcard" });
        }

        flashcard.topic = topic || flashcard.topic;
        flashcard.question = question || flashcard.question;
        flashcard.answer = answer || flashcard.answer;
        flashcard.notes = notes !== undefined ? notes : flashcard.notes;

        await flashcard.save();

        res.json({
            message: "Flashcard updated successfully!",
            flashcard,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


module.exports.deleteFlashcard = async (req, res) => {
    const { flashcardId } = req.params;

    try {
        const flashcard = await Flashcard.findById(flashcardId);

        if (!flashcard) {
            return res.status(404).json({ error: "Flashcard not found" });
        }

        if (flashcard.createdBy.toString() !== req.user._id) {
            return res.status(403).json({ error: "You are not authorized to delete this flashcard" });
        }

        await Flashcard.deleteOne({ _id: flashcardId });

        res.json({ message: "Flashcard deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


module.exports.getFlashcards = async (req, res) => {
    try {
        const flashcards = await Flashcard.find({ 
            createdBy: req.user.userId });
        res.json({ flashcards });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};