// const express = require('express');
// const router = express.Router();
// const multer = require('multer');
// const path = require('path');

// const quizController = require('../controllers/quizController');

// const authMiddleware = require("../middlewares/authMiddleware");

// // ✅ 1. Define multer storage
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, 'uploads/');
//     },
//     filename: (req, file, cb) => {
//         cb(null, Date.now() + path.extname(file.originalname));
//     },
// });

// // ✅ 2. Define allowed file types including .pptx
// const fileFilter = (req, file, cb) => {
//     const allowedTypes = [
//         'text/plain',
//         'application/pdf',
//         'application/vnd.ms-excel',
//         'application/vnd.openxmlformats-officedocument.presentationml.presentation' // .pptx
//     ];

//     if (allowedTypes.includes(file.mimetype)) {
//         cb(null, true);
//     } else {
//         cb(new Error('Only .txt, .pdf, .csv, and .pptx files are allowed!'), false);
//     }
// };

// // ✅ 3. Create multer instance
// const upload = multer({ storage, fileFilter });

// // ✅ 4. Routes
// router.post('/quiz', authMiddleware, upload.single('file'), quizController.createQuiz);
// router.post('/quiz/submit', authMiddleware, quizController.submitQuiz);
// // router.get('/quiz', authMiddleware, quizController.getAllQuizzes);
// router.get('/quiz/history', authMiddleware, quizController.getQuizHistory);




// module.exports = router;



const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const quizController = require('../controllers/quizController'); // Make sure this path is correct

const authMiddleware = require("../middlewares/authMiddleware");

// Define multer storage and fileFilter as you've already done

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'text/plain',
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' // .pptx
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only .txt, .pdf, .csv, and .pptx files are allowed!'), false);
    }
};

const upload = multer({ storage, fileFilter });

// Define your routes
router.post('/quiz', authMiddleware, upload.single('file'), quizController.createQuiz);  // Make sure this points to the correct controller method
router.post('/quiz/submit', authMiddleware, quizController.submitQuiz);
router.get('/quiz/history', authMiddleware, quizController.getQuizHistory);

module.exports = router;