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

        console.log("Raw AI Response:", responseText);

        let flashcards = [];
        try {
            flashcards = JSON.parse(responseText);
            if (!Array.isArray(flashcards)) flashcards = [];
        } catch (error) {
            console.error("Error parsing AI response:", error);
            return [];
        }

        // Generate images if needed
        for (const card of flashcards) {
            if (card.imageDescription) {
                card.image = await generateImage(card.imageDescription);
            }
        }

        return flashcards; // ✅ Return flashcards instead of sending a response
    } catch (error) {
        console.error("Backend Error:", error);
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
 * Creates flashcards manually or using AI.
 */
module.exports.createFlashcard = async (req, res) => {
    const userId = req.user._id;
    let extractedText = "";
    let generatedFlashcards = [];

    try {
        console.log("Received request body:", req.body); // Debugging
        console.log("Received file:", req.file);

        // 📌 Case 1: Manual Flashcard Submission (JSON input)
        if (req.body.flashcards && Array.isArray(req.body.flashcards)) {
            const flashcards = req.body.flashcards.map(card => ({
                topic: req.body.topic,
                notes: req.body.notes,
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

        // 📌 Case 2: Text Field for AI-Generated Flashcards (Create from Notes functionality)
        if (req.body.text) {
            console.log("Received text for AI generation:", req.body.text);

            // Ensure that the text is not empty or too short.
            if (!req.body.text.trim()) {
                return res.status(400).json({ error: "Text is empty." });
            }

            generatedFlashcards = await extractQnAUsingAI(req.body.text);

            if (!Array.isArray(generatedFlashcards) || generatedFlashcards.length < 2) {
                return res.status(400).json({ error: "AI did not generate enough flashcards." });
            }

            return res.status(201).json({ flashcards: generatedFlashcards });
        }

        // 📌 Case 3: File Upload (PDF for AI-generated flashcards)
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

            generatedFlashcards = await extractQnAUsingAI(extractedText);

            if (!Array.isArray(generatedFlashcards) || generatedFlashcards.length < 2) {
                return res.status(400).json({ error: "AI did not generate enough flashcards." });
            }

            const savedFlashcards = await Flashcard.insertMany(
                generatedFlashcards.map((card) => ({
                    topic: req.body.topic,
                    notes: req.body.notes,
                    question: card.question,
                    answer: card.answer,
                    image: card.image || null,
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


module.exports.getFlashcards = async (req, res) => {
    try {
        const flashcards = await Flashcard.find({ createdBy: req.user._id });
        res.json({ flashcards });
    } catch (error) {
        console.error("Error fetching flashcards:", error);
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
    } catch (error)        {
        console.error("Error deleting flashcard:", error);
        res.status(500).json({ error: error.message });
    }
};