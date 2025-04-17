const mongoose = require('mongoose');
const { extractTextFromFile } = require('../utils/fileExtractor');
const Quiz = require('../model/quiz');
const Flashcard = require('../model/flashcard');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_QUIZ_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });

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

    const savedQuiz = await Quiz.insertMany(
      questions.map(q => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        // score:q.score,
        topic,
        createdBy: userId,
      }))
    );

    res.status(201).json({ message: 'Quiz created successfully!', quiz: savedQuiz });
  } catch (error) {
    console.error('❌ Quiz creation error:', error);
    res.status(500).json({ error: 'Error creating quiz: ' + error.message });
  }
};

const submitQuiz = async (req, res) => {
  try {
    const { userId, quizId, answers } = req.body;

    if (!quizId || !answers || quizId.length !== answers.length) {
      return res.status(400).json({ error: 'Mismatched quiz and answers.' });
    }

    const questions = await Quiz.find({
      _id: { $in: quizId },
      createdBy: userId,
    });

    if (!questions || questions.length === 0) {
      return res.status(404).json({ error: 'Quiz questions not found.' });
    }

    let correctCount = 0;
    const results = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const userAnswer = answers[i].answer;
      const isCorrect = userAnswer === q.correctAnswer;

      if (isCorrect) correctCount++;

      results.push({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        userAnswer,
        isCorrect,
      });
    }

    const score = correctCount;
    const timeTaken = Math.floor((Date.now() - req.startTime || Date.now()) / 1000);

    // 🔥 No saving submission results to DB
    res.status(200).json({
      message: 'Quiz submitted successfully.',
      score,
      timeTaken,
      results,
    });
  } catch (error) {
    console.error('❌ Error submitting quiz:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getQuizHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const quizzes = await Quiz.find({ createdBy: userId }).sort({ createdAt: -1 });

    if (!quizzes.length) {
      return res.status(200).json({ message: "No quizzes found for this user." });
    }
    console.log('quizzes',quizzes);
    // 
    const history = quizzes.map(q => ({
      quizId: q._id,
      topic: q.topic,
      question: q.question,
      options: q.options,
      score: q.score,
      // ⛔ Do NOT expose correctAnswer/userAnswer/score/timeTaken
    }));

    res.status(200).json({
      message: 'Quiz generation history fetched!',
      quizzes: history,
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
};