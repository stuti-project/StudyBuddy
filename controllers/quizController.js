const mongoose = require('mongoose');
const { extractTextFromFile } = require('../utils/fileExtractor');
const Quiz = require('../model/quiz');
const Flashcard = require('../model/flashcard');
const Progress = require('../model/progress');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_QUIZ_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);

const generateFakeOptions = (correctAnswer) => {
  const distractors = [
    'Cloud storage techniques',
    'Data encryption methods',
    'System architecture patterns',
    'AI model tuning strategies',
    'Code versioning best practices',
  ];
  return shuffleArray(distractors.filter(d => d !== correctAnswer)).slice(0, 3);
};

const generateQuizFromText = async (text) => {
  const prompt = `Generate exactly 20 multiple-choice questions from this text:\n"${text}"
Each question should follow this format:
Q: Question here?
Options: Option1, Option2, Option3, Option4
Answer: CorrectOption`;

  const result = await model.generateContent(prompt);
  const responseText = await result.response.text();
  const blocks = responseText.split('\n\n');
  const questions = [];

  blocks.forEach(block => {
    const match = block.match(/Q:(.*?)Options:(.*?)Answer:(.*)/s);
    if (match) {
      const question = match[1].trim();
      const rawOptions = match[2].split(',').map(opt => opt.trim()).slice(0, 4);
      const correctAnswer = match[3].trim();

      questions.push({
        question,
        options: shuffleArray(rawOptions),
        correctAnswer,
      });
    }
  });

  return questions.length >= 20
    ? questions.slice(0, 20)
    : [...questions, ...Array(20 - questions.length).fill().map(() => questions[Math.floor(Math.random() * questions.length)])];
};

const generateQuizFromFlashcards = async (userId, topic) => {
  const flashcards = await Flashcard.find({ createdBy: userId, topic });
  if (!flashcards.length) throw new Error('No flashcards found for this topic.');

  return flashcards.map(fc => {
    const options = shuffleArray([fc.answer, ...generateFakeOptions(fc.answer)]);
    return {
      question: fc.question,
      options,
      correctAnswer: fc.answer
    };
  }).slice(0, 20);
};

const createQuiz = async (req, res) => {
  const { topic, sourceType, text } = req.body;
  const userId = req.user._id;

  try {
    let questions = [];

    switch (sourceType) {
      case 'file':
        if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
        const extractedText = await extractTextFromFile(req.file.path, req.file.mimetype);
        questions = await generateQuizFromText(extractedText);
        break;
      case 'text':
        questions = await generateQuizFromText(text);
        break;
      case 'flashcard':
        questions = await generateQuizFromFlashcards(userId, topic);
        break;
      default:
        return res.status(400).json({ error: 'Invalid source type.' });
    }

    const savedQuiz = questions.map(q => ({
      ...q,
      topic,
      createdBy: userId
    }));

    res.status(201).json({ message: 'Quiz created successfully!', quiz: savedQuiz });
  } catch (error) {
    console.error('❌ Quiz creation error:', error);
    res.status(500).json({ error: 'Error creating quiz: ' + error.message });
  }
};

const submitQuiz = async (req, res) => {
  try {
    const { quizId, answers, timeTaken } = req.body;
    const userId = req.user._id;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Invalid answers data.' });
    }

    let correctCount = 0;
    const detailedQuestions = answers.map((q) => {
      const isCorrect = q.userAnswer === q.correctAnswer;
      if (isCorrect) correctCount++;
      return {
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        userAnswer: q.userAnswer,
        isCorrect,
      };
    });

    const score = correctCount;

    const submission = new Quiz({
      createdBy: userId,
      isSubmission: true,
      takenAt: new Date(),
      score,
      timeTaken,
      userAnswers: answers.map(q => q.userAnswer),
      questions: answers.map(q => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
      })),
    });

    await submission.save();

    // ✅ Automatically track quiz progress
    await updateProgressAfterQuiz(userId, score, timeTaken);

    res.status(200).json({
      message: "Quiz submitted!",
      submissionId: submission._id,
      score,
      timeTaken,
      totalQuestions: answers.length,
      results: detailedQuestions,
    });

  } catch (error) {
    console.error('❌ Error submitting quiz:', error);
    res.status(500).json({ error: 'Error submitting quiz: ' + error.message });
  }
};

const updateProgressAfterQuiz = async (userId, score, timeTaken) => {
  try {
    await Progress.findOneAndUpdate(
      { userId },
      {
        $inc: {
          quizzesTaken: 1,
          totalQuizScore: score,
          totalTimeSpent: timeTaken
        },
        $set: { lastUpdated: new Date() }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("Failed to update quiz progress:", err.message);
  }
};


const getQuizHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const quizzes = await Quiz.find({ createdBy: userId });

    if (quizzes.length === 0) {
      return res.status(200).json({ message: "No quizzes found for this user." });
    }

    const quizHistory = quizzes.map(quiz => ({
      quizId: quiz._id,
      score: quiz.score,
      timeTaken: quiz.timeTaken,
      takenAt: quiz.takenAt,
      question: quiz.question,
      options: quiz.options,
      correctAnswer: quiz.correctAnswer,
      userAnswer: quiz.userAnswer,
      isCorrect: quiz.userAnswer === quiz.correctAnswer,
    }));

    res.status(200).json({
      message: 'Grouped quiz history fetched!',
      quizzes: quizHistory,
    });
  } catch (error) {
    console.error('❌ Error fetching quiz history:', error);
    res.status(500).json({ error: 'History error: ' + error.message });
  }
};




module.exports = {
  createQuiz,
  submitQuiz,
  generateQuizFromFlashcards,
  getQuizHistory,
  updateProgressAfterQuiz,
};