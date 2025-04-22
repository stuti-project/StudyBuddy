const Progress = require('../model/progress');
const Flashcard = require('../model/flashcard');
const QuizHistory = require('../model/quiz');



const submitQuiz = async (req, res) => {
  const { quizId, answers } = req.body;
  const userId = req.user._id;

  try {
    // Your existing quiz scoring and results logic
    let score = calculateScore(answers);  // Replace with your actual score calculation logic
    let results = {};  // Populate with actual results

    // Update quiz progress after submission
    await progressController.updateQuizProgress(req, res); // Ensure this is called after quiz submission

    res.status(200).json({ message: 'Quiz submitted!', score: `${score}%`, results });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ error: 'Submit error: ' + error.message });
  }
};


const getProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    
    let progress = await Progress.findOne({ userId });
    console.log(progress)
    if (!progress) {
      progress = new Progress({ userId });
      await progress.save();
    }

    res.status(200).json(progress);
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
};



// Update progress when flashcards are completed
const updateFlashcardProgress = async (req, res) => {
  const userId = req.user._id;
 
  
  try {
    let progress = await Progress.findOne({ userId });
    
    if (!progress) {
      // If no progress record exists, create one for the user
      progress = new Progress({ userId });
    }

    // Update flashcards completed
    progress.flashcardsCompleted += 1;

    // Save progress
    await progress.save();
    console.log(progress)
    res.status(200).json({ message: 'Flashcard progress updated!' });
  } catch (error) {
    console.error('Error updating flashcard progress:', error);
    res.status(500).json({ error: 'Error updating flashcard progress' });
  }
};


// Update progress when a quiz is taken
const updateQuizProgress = async (req, res) => {
  const userId = req.user._id;
  
  try {
    let progress = await Progress.findOne({ userId });
    
    if (!progress) {
      // If no progress record exists, create one for the user
      progress = new Progress({ userId });
    }

    // Update quizzes taken
    progress.quizzesTaken += 1;

    // Save progress
    await progress.save();

    res.status(200).json({ message: 'Quiz progress updated!' });
  } catch (error) {
    console.error('Error updating quiz progress:', error);
    res.status(500).json({ error: 'Error updating quiz progress' });
  }
};



module.exports = {
  submitQuiz,
  getProgress,
  updateFlashcardProgress,
  updateQuizProgress,
};
