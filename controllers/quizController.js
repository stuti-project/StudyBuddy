const { extractTextFromFile } = require('../utils/fileExtractor');
const Quiz = require('../model/quiz');
const Flashcard = require('../model/flashcard'); 
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');



const genAI = new GoogleGenerativeAI(process.env.GEMINI_QUIZ_KEY);
console.log("GEMINI API Key:", process.env.GEMINI_QUIZ_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });


const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);


const generateQuizFromText = async (text) => {
    const prompt = `Generate exactly 20 multiple-choice quiz questions based on the following text: "${text}"

Each question should have:
- One correct answer
- Four options only (no more, no less)
- DO NOT include labels like A), B., etc. Just provide raw options

Format each question like this:

Q: What is the capital of France?
Options: Paris, London, Berlin, Madrid
Answer: Paris`;

    try {
        const result = await model.generateContent(prompt);
        const aiResponse = await result.response.text();

        let questions = [];
        const questionBlocks = aiResponse.split("\n\n");

        questionBlocks.forEach((qna) => {
            const match = qna.match(/Q:(.*?)Options:(.*?)Answer:(.*)/s);
            if (match) {
                const rawOptions = match[2].split(",").map(opt => {
                    return opt.replace(/^([A-Da-d])[\.\):\s]+/, '').trim();
                });

                const questionObj = {
                    question: match[1].trim(),
                    options: shuffleArray(rawOptions).slice(0, 4), // Always take only 4
                    correctAnswer: match[3].trim()
                };

                questions.push(questionObj);
            }
        });

        // Trim or duplicate to get exactly 20
        if (questions.length > 20) {
            questions = questions.slice(0, 20);
        } else if (questions.length < 20) {
            const extra = [];
            while (questions.length + extra.length < 20) {
                const copy = questions[Math.floor(Math.random() * questions.length)];
                extra.push({ ...copy });
            }
            questions = [...questions, ...extra];
        }

        return questions;
    } catch (error) {
        throw new Error("Error generating quiz questions: " + error.message);
    }
};


const createQuiz = async (req, res) => {
    const { topic, sourceType, language, text } = req.body;
    const userId = req.user.userId;

    let quizQuestions = [];
    let extractedText = '';

    try {
        // 🔍 Handle source types
        if (sourceType === 'file') {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded.' });
            }

            try {
                extractedText = await extractTextFromFile(req.file.path, req.file.mimetype);
                quizQuestions = await generateQuizFromText(extractedText);
            } catch (err) {
                console.error('Error extracting or processing file:', err);
                return res.status(500).json({ error: 'Failed to extract or generate quiz from file.' });
            }

        } else if (sourceType === 'text' && text) {
            extractedText = text;
            quizQuestions = await generateQuizFromText(text);
        } else if (sourceType === 'flashcard') {
            quizQuestions = await generateQuizFromFlashcards(userId, topic);
        } else {
            return res.status(400).json({ error: 'Invalid source type or missing input.' });
        }

        // 🔄 Top-up if fewer than 20 questions
        if (quizQuestions.length < 20) {
            const additionalNeeded = 20 - quizQuestions.length;
            let moreQuestions = [];

            if (sourceType === 'flashcard') {
                moreQuestions = await generateQuizFromFlashcards(userId, topic);
            } else {
                moreQuestions = await generateQuizFromText(extractedText);
            }

            quizQuestions = [...quizQuestions, ...moreQuestions.slice(0, additionalNeeded)];
        }

        // 🚫 No questions at all
        if (quizQuestions.length === 0) {
            return res.status(400).json({ error: "No quiz questions could be generated." });
        }

        // 💾 Save quiz
        const savedQuiz = await Quiz.insertMany(
            quizQuestions.map(q => ({ ...q, createdBy: userId }))
        );

        res.status(201).json({
            message: "Quiz created successfully!",
            quiz: savedQuiz,
        });
    } catch (error) {
        console.error('Quiz creation error:', error);
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};


const submitQuiz = async (req, res) => {
    const { quizId, answers } = req.body;
    const userId = req.user.userId;

    if (!quizId || !answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: "Quiz ID and answers are required." });
    }

    try {
        // Validate quizId(s) to ensure they are ObjectIds
        const validQuizIds = Array.isArray(quizId)
            ? quizId.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id))
            : [];

        if (validQuizIds.length === 0) {
            return res.status(400).json({ error: "Invalid quiz ID(s)." });
        }

        const quizQuestions = await Quiz.find({ _id: { $in: validQuizIds } });

        if (!quizQuestions.length) {
            return res.status(400).json({ error: "Invalid quiz ID or quiz not found." });
        }

        let correctCount = 0;
        let results = [];

        quizQuestions.forEach((q) => {
            const userAnswerObj = answers.find(ans => ans.question === q.question);
            const userAnswer = userAnswerObj ? userAnswerObj.answer : "";

            const isCorrect = q.correctAnswer === userAnswer;
            if (isCorrect) correctCount++;

            results.push({
                question: q.question,
                correctAnswer: q.correctAnswer,
                userAnswer,
                isCorrect
            });
        });

        const score = (correctCount / quizQuestions.length) * 100;

        res.status(200).json({
            message: "Quiz submitted successfully!",
            score: `${score}%`,
            results
        });
    } catch (error) {
        res.status(500).json({ error: "Server error: " + error.message });
    }
};

const generateQuizFromFlashcards = async (userId, topic) => {
    try {
        const flashcards = await Flashcard.find({ createdBy: userId, topic });

        if (!flashcards.length) {
            throw new Error("No flashcards found for the selected topic.");
        }

        let questions = flashcards.map(fc => {
            // If no options are provided, create a set of multiple choice options
            let options = [fc.answer]; // Start with the correct answer

            // Generate fake answers (You can implement your own logic for this)
            const fakeOptions = generateFakeOptions(fc.answer); // Custom function to generate wrong answers
            
            options = [...options, ...fakeOptions];
            
            // Shuffle the options
            options = shuffleArray(options);

            return {
                question: fc.question,
                options: options, // MCQ options
                correctAnswer: fc.answer
            };
        });

        return questions;
    } catch (error) {
        throw new Error(error.message);
    }
};

const getAllQuizzes = async (req, res) => {
    try {
        console.log("User Info:", req.user);
        const quizzes = await Quiz.find().populate('createdBy', 'name email'); // Populating user details (optional)
        res.status(200).json(quizzes);
    } catch (error) {
        res.status(500).json({ error: "Error fetching quizzes: " + error.message });
    }
};

module.exports = { createQuiz, submitQuiz, generateQuizFromFlashcards, getAllQuizzes };


const generateFakeOptions = (correctAnswer) => {
    
    const fakeAnswers = [
        "Software testing and debugging.",
        "Machine learning model optimization.",
        "Financial forecasting.",
        "Data security management.",
    ];

    const filteredFakeAnswers = fakeAnswers.filter(answer => answer !== correctAnswer);
    
    return filteredFakeAnswers.sort(() => Math.random() - 0.5).slice(0, 3); 
};


module.exports = { createQuiz, submitQuiz , getAllQuizzes, generateQuizFromFlashcards};