const Flashcard = require("../model/flashcard");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_FLASHCARD_KEY);
const upload = multer({ dest: "uploads/" });

/**
 * Extracts Q&A pairs from the given text using AI.
 * @param {string} text - The extracted text from the document.
 * @returns {Array} - List of extracted flashcards with question and answer pairs.
 */
async function extractQnAUsingAI(text) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
        const prompt = `Extract at least 5 question-answer pairs from the following study material:\n${text}\nFormat: [{"question": "...?", "answer": "..."}]`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().replace(/```json|```/g, "").trim();

        let flashcards = [];
        try {
            flashcards = JSON.parse(responseText);
            if (!Array.isArray(flashcards)) flashcards = [];
        } catch (error) {
            console.error("Error parsing AI response:", error);
            flashcards = [];
        }

        return flashcards.filter(card => card.question && card.answer);
    } catch (error) {
        console.error("AI Extraction Error:", error);
        return [];
    }
}

/**
 * Extracts text from a PDF file.
 * @param {string} filePath - The path to the uploaded PDF file.
 * @returns {string} - Extracted text from the PDF.
 */
async function extractTextFromFile(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        return (await pdfParse(dataBuffer)).text;
    } catch (error) {
        console.error("File Extraction Error:", error);
        return "";
    }
}

/**
 * Handles file uploads and extracts flashcards using AI.
 */
module.exports.uploadFlashcards = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        const filePath = req.file.path;
        const extractedText = await extractTextFromFile(filePath);
        fs.unlinkSync(filePath); // Delete file after extraction

        if (!extractedText) {
            return res.status(400).json({ error: "Could not extract text from file." });
        }

        const generatedFlashcards = await extractQnAUsingAI(extractedText);

        if (!generatedFlashcards || generatedFlashcards.length < 2) {
            return res.status(400).json({ error: "AI did not generate enough flashcards." });
        }

        res.status(201).json({ flashcards: generatedFlashcards });
    } catch (error) {
        console.error("Error processing file:", error);
        res.status(500).json({ error: "Failed to process the file." });
    }
};

/**
 * Creates flashcards manually or using AI.
 */
module.exports.createFlashcard = async (req, res) => {
    const userId = req.user._id;
    let extractedText = "";
    let generatedFlashcards = [];

    try {
        // 📌 Case 1: Manually Adding Flashcards
        if (req.body.flashcards) {
            const flashcards = req.body.flashcards.map((card) => ({
                topic: req.body.topic,
                notes: req.body.notes, // Add notes
                question: card.question,
                answer: card.answer,
                image: card.image || null,
                createdBy: userId,
            }));

            const savedFlashcards = await Flashcard.insertMany(flashcards);

            return res.status(201).json({
                message: `${savedFlashcards.length} flashcards created successfully!`,
                flashcards: savedFlashcards,
            });
        }

        // 📌 Case 2: AI-Generated Flashcards from PDF
        if (req.file) {
            const filePath = req.file.path;
            const fileType = req.file.mimetype;

            if (fileType !== "application/pdf") {
                return res.status(400).json({ error: "Only PDF files are allowed." });
            }

            extractedText = await extractTextFromFile(filePath);
            fs.unlinkSync(filePath); // Cleanup uploaded file

            if (!extractedText) {
                return res.status(400).json({ error: "Failed to extract text from file." });
            }

            // Generate Flashcards with AI (including images)
            generatedFlashcards = await extractQnAUsingAI(extractedText);

            if (!Array.isArray(generatedFlashcards) || generatedFlashcards.length < 2) {
                return res.status(400).json({ error: "AI did not generate enough flashcards." });
            }

            // Save AI-generated flashcards to the database
            const savedFlashcards = await Flashcard.insertMany(
                generatedFlashcards.map((card) => ({
                    topic: req.body.topic,
                    notes: req.body.notes, // Save notes with flashcards
                    question: card.question,
                    answer: card.answer,
                    image: card.image || null, // AI-generated image support
                    createdBy: userId,
                }))
            );

            return res.status(201).json({
                message: `${savedFlashcards.length} AI-generated flashcards created!`,
                flashcards: savedFlashcards,
            });
        }

        return res.status(400).json({ error: "No valid data provided for flashcards." });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Retrieves all flashcards for the authenticated user.
 */
module.exports.getFlashcards = async (req, res) => {
    try {
        const flashcards = await Flashcard.find({ createdBy: req.user._id });
        res.json({ flashcards });
    } catch (error) {
        console.error("Error fetching flashcards:", error);
        res.status(500).json({ error: "Server error" });
    }
};

/**
 * Updates an existing flashcard.
 */
module.exports.updateFlashcard = async (req, res) => {
    const { flashcardId } = req.params;
    const { topic, question, answer, notes } = req.body;
    const imagePath = req.file ? req.file.path : null;

    try {
        const flashcard = await Flashcard.findById(flashcardId);

        if (!flashcard) {
            return res.status(404).json({ error: "Flashcard not found" });
        }

        if (flashcard.createdBy.toString() !== req.user._id) {
            return res.status(403).json({ error: "Unauthorized action." });
        }

        flashcard.topic = topic || flashcard.topic;
        flashcard.question = question || flashcard.question;
        flashcard.answer = answer || flashcard.answer;
        flashcard.notes = notes !== undefined ? notes : flashcard.notes;
        if (imagePath) flashcard.image = imagePath;

        await flashcard.save();

        res.json({ message: "Flashcard updated successfully!", flashcard });
    } catch (error) {
        console.error("Error updating flashcard:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Deletes a flashcard.
 */
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
        console.error("Error deleting flashcard:", error);
        res.status(500).json({ error: error.message });
    }
};
