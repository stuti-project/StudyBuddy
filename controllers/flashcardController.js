const Flashcard = require("../model/flashcard");
const Progress = require("../model/progress");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_FLASHCARD_KEY);
const upload = multer({ dest: "uploads/" });

// -------------------- Utility Functions -------------------- //

/**
 * Extract text from a PDF file
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
 * Generate image from image description using AI (mocked or implement your own)
 */
async function generateImage(description) {
    // TODO: Implement image generation logic if needed
    return `https://dummyimage.com/600x400/000/fff&text=${encodeURIComponent(description)}`;
}

/**
 * Extract Q&A pairs using Gemini AI
 */
async function extractQnAUsingAI(text, topic) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        const prompt = `Extract at least 5 question-answer pairs from the following study material. 
If an image is relevant to better understanding, provide a short image description.

Format: [{"question": "...?", "answer": "...", "imageDescription": "..."}]

Topic: ${topic}
Text: ${text}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().replace(/```json|```/g, "").trim();

        let flashcards = [];
        try {
            flashcards = JSON.parse(responseText);
            if (!Array.isArray(flashcards)) flashcards = [];
        } catch (error) {
            console.error("Error parsing AI response:", error);
            return [];
        }

        for (const card of flashcards) {
            if (card.imageDescription) {
                card.image = await generateImage(card.imageDescription);
            }
        }

        return flashcards;
    } catch (error) {
        console.error("AI Generation Error:", error);
        return [];
    }
}


async function updateProgressAfterFlashcards(userId, count = 1) {
    try {
        await Progress.findOneAndUpdate(
            { userId },
            {
                $inc: { flashcardsCompleted: count },
                $set: { lastUpdated: new Date() },
            },
            { upsert: true }
        );
    } catch (err) {
        console.error("Failed to update flashcard progress:", err.message);
    }
}

// Mark a flashcard as reviewed and update the progress
async function reviewFlashcard(userId, flashcardId) {
    try {
        const flashcard = await Flashcard.findById(flashcardId);
        if (flashcard && !flashcard.reviewed) {
            flashcard.reviewed = true;
            await flashcard.save();
            await updateProgressAfterFlashcards(userId, 1);  // Increment reviewed count by 1
        }
    } catch (err) {
        console.error("Failed to review flashcard:", err.message);
    }
}

// Group flashcards by topic
async function groupFlashcardsByTopic(filter = {}) {
    const flashcards = await Flashcard.find(filter);
    const grouped = {};
    for (const card of flashcards) {
        if (!grouped[card.topic]) grouped[card.topic] = [];
        grouped[card.topic].push(card);
    }
    return grouped;
}

// -------------------- Controller Exports -------------------- //

module.exports.createFlashcard = async (req, res) => {
    const userId = req.user._id;
    let generatedFlashcards = [];

    try {
        if (req.body.flashcards && Array.isArray(req.body.flashcards)) {
            // Manual submission
            const flashcards = req.body.flashcards.map(card => ({
                topic: req.body.topic,
                notes: req.body.notes,
                question: card.question,
                answer: card.answer,
                image: card.image || null,
                createdBy: userId,
                reviewed: false, // New flashcards start as not reviewed
            }));

            const saved = await Flashcard.insertMany(flashcards);
            await updateProgressAfterFlashcards(userId, saved.length);

            return res.status(201).json({
                message: `${saved.length} flashcards created successfully!`,
                flashcards: saved,
            });
        }

        if (req.body.text) {
            // AI-generated from text
            if (!req.body.text.trim()) {
                return res.status(400).json({ error: "Text is empty." });
            }

            generatedFlashcards = await extractQnAUsingAI(req.body.text, req.body.topic);
            if (!Array.isArray(generatedFlashcards) || generatedFlashcards.length < 2) {
                return res.status(400).json({ error: "AI did not generate enough flashcards." });
            }

            return res.status(201).json({ flashcards: generatedFlashcards });
        }

        if (req.file) {
            // PDF Upload
            const filePath = req.file.path;
            const fileType = req.file.mimetype;

            if (fileType !== "application/pdf") {
                return res.status(400).json({ error: "Only PDF files are allowed." });
            }

            const extractedText = await extractTextFromFile(filePath);
            fs.unlinkSync(filePath);

            if (!extractedText) {
                return res.status(400).json({ error: "Failed to extract text from file." });
            }

            generatedFlashcards = await extractQnAUsingAI(extractedText, req.body.topic);
            if (!Array.isArray(generatedFlashcards) || generatedFlashcards.length < 2) {
                return res.status(400).json({ error: "AI did not generate enough flashcards." });
            }

            const saved = await Flashcard.insertMany(
                generatedFlashcards.map(card => ({
                    topic: req.body.topic,
                    notes: req.body.notes,
                    question: card.question,
                    answer: card.answer,
                    image: card.image || null,
                    createdBy: userId,
                    reviewed: false, // New flashcards start as not reviewed
                }))
            );

            await updateProgressAfterFlashcards(userId, saved.length);

            return res.status(201).json({
                message: `${saved.length} AI-generated flashcards created!`,
                flashcards: saved,
            });
        }

        return res.status(400).json({ error: "No valid data provided for flashcards." });
    } catch (error) {
        console.error("Create Flashcard Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Mark a flashcard as reviewed (called when user reviews the flashcard)
// module.exports.reviewFlashcard = async (req, res) => {
//     const userId = req.user._id;
//     const { flashcardId } = req.params;

//     try {
//         await reviewFlashcard(userId, flashcardId);
//         return res.status(200).json({ message: "Flashcard marked as reviewed." });
//     } catch (err) {
//         return res.status(500).json({ error: "Failed to mark flashcard as reviewed." });
//     }
// };

module.exports.getFlashcards = async (req, res) => {
    const { id, topic } = req.query;
    const filter = {};
    if (id) filter.createdBy = id;
    if (topic) filter.topic = { $regex: topic, $options: "i" };

    try {
        const flashcards = await Flashcard.find(filter);
        if (!flashcards.length) {
            return res.status(404).json({ message: "No flashcards found." });
        }
        res.json({ flashcards });
    } catch (error) {
        console.error("Fetch Flashcards Error:", error);
        res.status(500).json({ error: "Server error" });
    }
};

module.exports.getAllFlashcardsGrouped = async (req, res) => {
    try {
        const grouped = await groupFlashcardsByTopic();
        return res.status(200).json({ grouped });
    } catch (error) {
        console.error("Error fetching all grouped flashcards:", error);
        res.status(500).json({ error: "Server error" });
    }
};

module.exports.getMyFlashcardsGrouped = async (req, res) => {
    const userId = req.user._id;
    try {
        const grouped = await groupFlashcardsByTopic({ createdBy: userId });
        return res.status(200).json({ grouped });
    } catch (error) {
        console.error("Error fetching user's grouped flashcards:", error);
        res.status(500).json({ error: "Server error" });
    }
};

module.exports.getFlashcardsByTopic = async (req, res) => {
    const { topic } = req.params;
    const userId = req.user ? req.user._id : req.query.user;

    const filter = { topic: { $regex: topic, $options: "i" } };
    if (userId) filter.createdBy = userId;

    try {
        const flashcards = await Flashcard.find(filter);
        if (!flashcards.length) {
            return res.status(404).json({ message: "No flashcards found for this topic." });
        }
        res.json({ flashcards });
    } catch (error) {
        console.error("Error fetching flashcards by topic:", error);
        res.status(500).json({ error: "Server error" });
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
