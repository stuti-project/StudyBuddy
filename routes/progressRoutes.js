const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const authMiddleware = require("../middlewares/authMiddleware")

router.get('/',authMiddleware, progressController.getProgress);


router.post('/flashcard',authMiddleware, progressController.updateFlashcardProgress);

router.post('/quiz',authMiddleware, progressController.updateQuizProgress);

// router.post('/progress/task', progressController.updateTaskProgress);
// router.post('/progress/topic', progressController.updateCurrentTopic);


module.exports = router;
