const express = require('express');
const router = express.Router();
const flashcardController = require("../controllers/flashcardController");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require('multer');


const upload = multer({ dest: 'uploads/' }); // Temporary storage

router.post("/flashcards", authMiddleware, upload.single("file"), flashcardController.createFlashcard);
router.get("/flashcards", authMiddleware, flashcardController.getFlashcards);
router.put("/flashcards/:flashcardId", authMiddleware, flashcardController.updateFlashcard);
router.delete("/flashcards/:flashcardId", authMiddleware, flashcardController.deleteFlashcard);

module.exports = router;