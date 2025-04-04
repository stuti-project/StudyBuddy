const express = require('express');
const router = express.Router();
const flashcardController = require("../controllers/flashcardController");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require('multer');

// Define file filter first
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Only PDF, PPT, PPTX, DOC, and DOCX files are allowed"), false);
  }

  cb(null, true);
};

// Define multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

// Set up multer with storage and fileFilter
const upload = multer({ storage, fileFilter });

// Flashcards Routes
router.post("/flashcards", authMiddleware, upload.single("file"), flashcardController.createFlashcard);

router.get("/flashcards", authMiddleware, flashcardController.getFlashcards);
router.put("/flashcards/:flashcardId", authMiddleware, upload.single("file"), flashcardController.updateFlashcard);
router.delete("/flashcards/:flashcardId", authMiddleware, flashcardController.deleteFlashcard);

module.exports = router;