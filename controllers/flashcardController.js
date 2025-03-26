const Flashcard = require('../model/flashcard');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_FLASHCARD_KEY);

async function extractQnAUsingAI(text) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        const prompt = `
        Extract at least 5 question-answer pairs from the following study material:
        - Focus on key concepts.
        - Keep questions and answers concise.
        - If fewer than 5 pairs are generated, return at least 2 meaningful pairs.

        Text: "${text}"

        Format the output as a JSON array:
        [
            { "question": "What is ...?", "answer": "It is ..." },
            { "question": "How does ... work?", "answer": "It works by ..." }
        ]
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawText = response.text().replace(/```json|```/g, "").trim();
        return JSON.parse(rawText);
    } catch (error) {
        console.error("AI Extraction Error:", error);
        return [];
    }
}

async function extractTextFromFile(filePath, fileType) {
    try {
        if (fileType === "application/pdf") {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text;
        } else {
            throw new Error("Unsupported file type");
        }
    } catch (error) {
        console.error("File Extraction Error:", error);
        return "";
    }
}

module.exports.createFlashcard = async (req, res) => {
    const userId = req.user.userId;

    try {
        let extractedText = "";
        let generatedFlashcards = [];

        // ❌ Stop if the topic is missing
        if (!req.body.topic) {
            return res.status(400).json({ error: "Topic is required. Please provide a topic." });
        }

        // ✅ CASE 1: User provides topic, question, and answer → Save directly (NO AI)
        if (req.body.question && req.body.answer) {
            const flashcard = new Flashcard({
                topic: req.body.topic,
                question: req.body.question,
                answer: req.body.answer,
                notes: req.body.notes || "",
                image: req.file ? req.file.path : null, 
                createdBy: userId
            });

            await flashcard.save();
            return res.status(201).json({
                message: "Flashcard created successfully!",
                flashcard
            });
        }

        // ✅ CASE 2: User uploads a file
        if (req.file) {
            const filePath = req.file.path;
            const fileType = req.file.mimetype;

            extractedText = await extractTextFromFile(filePath, fileType);
            fs.unlinkSync(filePath); 
        }

        // ✅ CASE 3: User provides text → Use AI to generate flashcards
        if (req.body.text) {
            extractedText = req.body.text.trim();
        }

        // ❌ No valid input detected (Neither manual nor AI-based)
        if (!extractedText) {
            return res.status(400).json({ error: "No valid input detected. Please provide a question & answer, upload a file, or enter study material as text." });
        }

        // ✅ AI Process (Generate flashcards from extracted text)
        generatedFlashcards = await extractQnAUsingAI(extractedText);

        if (!Array.isArray(generatedFlashcards) || generatedFlashcards.length < 2) {
            return res.status(400).json({ error: "AI did not generate enough questions." });
        }

        const topic = req.body.topic; // ✅ Always use user-provided topic

        // ✅ Save AI-generated flashcards with user ID
        const savedFlashcards = await Flashcard.insertMany(
            generatedFlashcards.map(card => ({
                topic,  // ✅ Use user-provided topic
                question: card.question,
                answer: card.answer,
                notes: "",  
                image: req.file ? req.file.path : null, 
                createdBy: userId
            }))
        );

        return res.status(201).json({
            message: `${savedFlashcards.length} flashcard(s) created successfully!`,
            flashcards: savedFlashcards
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


module.exports.updateFlashcard = async (req, res) => {
    const { flashcardId } = req.params;
    const { topic, question, answer, notes } = req.body;
    const imagePath = req.file ? req.file.path : null;

    try {
        const flashcard = await Flashcard.findById(flashcardId);

        if (!flashcard) {
            return res.status(404).json({ error: "Flashcard not found" });
        }

        if (flashcard.createdBy.toString() !== req.user.userId) {
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
        res.status(500).json({ error: error.message });
    }
};

module.exports.getFlashcards = async (req, res) => {
    try {
        const flashcards = await Flashcard.find({ createdBy: req.user.userId });
        res.json({ flashcards });
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

        if (flashcard.createdBy.toString() !== req.user.userId) {
            return res.status(403).json({ error: "You are not authorized to delete this flashcard" });
        }

        await Flashcard.deleteOne({ _id: flashcardId });

        res.json({ message: "Flashcard deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
