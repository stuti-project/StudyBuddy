const Flashcard = require("../model/flashcard");
const Progress = require("../model/progress");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_FLASHCARD_KEY);
const upload = multer({ dest: "uploads/" });

async function extractTextFromFile(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        return (await pdfParse(dataBuffer)).text;
    } catch (error) {
        console.error("File Extraction Error:", error);
        return "";
    }
}

async function generateImage(description) {
    return `https://dummyimage.com/600x400/000/fff&text=${encodeURIComponent(description)}`;
}

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

async function reviewFlashcard(userId, flashcardId) {
    try {
        const flashcard = await Flashcard.findById(flashcardId);
        if (flashcard && !flashcard.reviewed) {
            flashcard.reviewed = true;
            await flashcard.save();
            await updateProgressAfterFlashcards(userId, 1);  
        }
    } catch (err) {
        console.error("Failed to review flashcard:", err.message);
    }
}

async function groupFlashcardsByTopic(filter = {}) {
    const flashcards = await Flashcard.find(filter);
    const grouped = {};
    for (const card of flashcards) {
        if (!grouped[card.topic]) grouped[card.topic] = [];
        grouped[card.topic].push(card);
    }
    return grouped;
}

module.exports.createFlashcard = async (req, res) => {
  const userId = req.user._id;

  try {
    // 1. Manual flashcards submission (Save to DB)
    if (req.body.flashcards && Array.isArray(req.body.flashcards)) {
      const flashcardDoc = new Flashcard({
        topic: req.body.topic,
        createdBy: userId,
        cards: req.body.flashcards.map(card => ({
          question: card.question,
          answer: card.answer,
          image: card.image || "",
          notes: card.notes || ""
        }))
      });

      const saved = await flashcardDoc.save();
      await updateProgressAfterFlashcards(userId, saved.cards.length);

      return res.status(201).json({
        message: `${saved.cards.length} flashcards created successfully!`,
        flashcards: saved,
      });
    }

    // 2. AI-generated flashcards from pasted text (Generate only, do NOT save)
    if (req.body.text) {
      if (!req.body.text.trim()) {
        return res.status(400).json({ error: 'Text is empty.' });
      }

      const topic = req.body.topic || "General";
      const generatedFlashcards = await extractQnAUsingAI(req.body.text, topic);

      if (!Array.isArray(generatedFlashcards) || generatedFlashcards.length < 2) {
        return res.status(400).json({ error: 'AI did not generate enough flashcards.' });
      }

      // ✅ Return generated cards without saving
      return res.status(200).json({
        message: `${generatedFlashcards.length} AI-generated flashcards ready for review.`,
        flashcards: generatedFlashcards,
      });
    }

    // 3. AI-generated flashcards from file upload (Generate only, do NOT save)
    if (req.file) {
      const filePath = req.file.path;
      const fileType = req.file.mimetype;

      if (fileType !== 'application/pdf') {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'Only PDF files are allowed.' });
      }

      const extractedText = await extractTextFromFile(filePath);
      fs.unlinkSync(filePath);

      if (!extractedText) {
        return res.status(400).json({ error: 'Failed to extract text from file.' });
      }

      const generatedFlashcards = await extractQnAUsingAI(extractedText, req.body.topic || 'General');

      if (!Array.isArray(generatedFlashcards) || generatedFlashcards.length < 2) {
        return res.status(400).json({ error: 'AI did not generate enough flashcards.' });
      }

      // ✅ Return generated cards without saving
      return res.status(200).json({
        message: `${generatedFlashcards.length} AI-generated flashcards ready for review.`,
        flashcards: generatedFlashcards,
      });
    }

    // If no valid input provided
    return res.status(400).json({ error: 'No valid data provided for flashcards.' });

  } catch (error) {
    console.error("Create Flashcard Error:", error);
    res.status(500).json({ error: error.message });
  }
};


  

// flashcardController.js

// Get all flashcards (optionally filtered by user ID and topic)
module.exports.getFlashcards = async (req, res) => {
    const { id, topic } = req.query;
    const filter = {};
  
    if (id) filter.createdBy = id;
    if (topic) filter.topic = { $regex: topic, $options: "i" };
  
    try {
      const flashcardDocs = await Flashcard.find(filter);
  
      if (!flashcardDocs.length) {
        return res.status(404).json({ message: "No flashcards found." });
      }
  
      const flashcards = flashcardDocs.flatMap(doc =>
        doc.cards.map(card => ({
          cardId: `${doc._id}_${doc.cards.indexOf(card)}`,
          question: card.question,
          answer: card.answer,
          image: card.image,
          notes: card.notes,
          topic: doc.topic,
          createdBy: doc.createdBy,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        }))
      );
  
      res.json({ flashcards });
    } catch (error) {
      console.error("Fetch Flashcards Error:", error);
      res.status(500).json({ error: "Server error" });
    }
  };
  
  // Group all flashcards by topic (for "All Flashcards")
  module.exports.getAllFlashcardsGrouped = async (req, res) => {
    try {
      const flashcardDocs = await Flashcard.find();
  
      const grouped = {};
  
      flashcardDocs.forEach(doc => {
        grouped[doc._id] = doc.cards.map((card, index) => ({
          cardId: `${doc._id}_${index}`,
          question: card.question,
          answer: card.answer,
          image: card.image,
          notes: card.notes,
          topic: doc.topic,
          createdBy: doc.createdBy,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        }));
      });
  
      res.status(200).json({ grouped });
    } catch (error) {
      console.error("Error fetching grouped flashcards:", error);
      res.status(500).json({ error: "Server error" });
    }
  };
  
  // Group user's flashcards by topic (for "My Flashcards")
  module.exports.getMyFlashcardsGrouped = async (req, res) => {
    const userId = req.user._id;
  
    try {
      const flashcardDocs = await Flashcard.find({ createdBy: userId });
  
      if (!flashcardDocs.length) {
        return res.status(404).json({ message: "No flashcards found." });
      }
  
      const grouped = {};
  
      flashcardDocs.forEach(doc => {
        grouped[doc._id] = doc.cards.map((card, index) => ({
          cardId: `${doc._id}_${index}`,
          question: card.question,
          answer: card.answer,
          image: card.image,
          notes: card.notes,
          topic: doc.topic,
          createdBy: doc.createdBy,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        }));
      });
  
      res.status(200).json({ grouped });
    } catch (error) {
      console.error("Error fetching user's grouped flashcards:", error);
      res.status(500).json({ error: "Server error" });
    }
  };
  
  // Get flashcards of a specific document by its _id
  module.exports.getFlashcardsById = async (req, res) => {
    const { id } = req.params;
    const userId = req.user ? req.user._id : req.query.user;
  
    const filter = { _id: id };
    if (userId) filter.createdBy = userId;
  
    try {
      const flashcardDoc = await Flashcard.findOne(filter);
  
      if (!flashcardDoc) {
        return res.status(404).json({ message: "No flashcards found with this ID." });
      }
  
      const flashcards = flashcardDoc.cards.map((card, index) => ({
        cardId: `${flashcardDoc._id}_${index}`,
        question: card.question,
        answer: card.answer,
        image: card.image,
        notes: card.notes,
        topic: flashcardDoc.topic,
        createdBy: flashcardDoc.createdBy,
        createdAt: flashcardDoc.createdAt,
        updatedAt: flashcardDoc.updatedAt,
      }));
  
      res.json({ flashcards });
    } catch (error) {
      console.error("Error fetching flashcards by ID:", error);
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
