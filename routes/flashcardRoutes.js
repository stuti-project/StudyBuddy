const express = require('express');
const router = express.Router();
const flashcardController = require("../controllers/flashcardController");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require('multer');

// Multer setup for handling file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Only images (PNG, JPEG) and PDFs are allowed"), false);
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter });

// Flashcards Routes
router.post("/flashcards", authMiddleware, upload.single('file'), flashcardController.createFlashcard);
// router.post("/upload", authMiddleware, upload.single("file"), flashcardController.uploadFlashcards);
router.get("/flashcards", authMiddleware, flashcardController.getFlashcards);
router.put("/flashcards/:flashcardId", authMiddleware, upload.single("file"), flashcardController.updateFlashcard);
router.delete("/flashcards/:flashcardId", authMiddleware, flashcardController.deleteFlashcard);

module.exports = router;