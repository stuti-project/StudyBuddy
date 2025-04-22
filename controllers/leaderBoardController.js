const Users = require("../model/reg"); // Corrected model name
const Progress = require("../model/progress");
const QuizHistory = require("../model/quiz");

module.exports.getLeaderboard = async (req, res) => {
  try {
    // Aggregate total quiz scores by user
    const quizData = await QuizHistory.aggregate([
      {
        $group: {
          _id: "$createdBy",
          totalScore: { $sum: "$score" }
        }
      }
    ]);

    const quizMap = {};
    quizData.forEach(entry => {
      if (entry._id) {
        quizMap[entry._id.toString()] = entry.totalScore;
      }
    });

    // Fetch progress and populate user info
    const progressData = await Progress.find({}).populate("userId", "UserName Email");

    const leaderboard = progressData
      .filter(p => p.userId)
      .map(progress => {
        const user = progress.userId;

        const flashcardScore = progress.flashcardsCompleted || 0;
        const quizScore = quizMap[user._id.toString()] || 0;

        return {
          user: {
            name: user.UserName || "Unknown",     // changed to `name` for frontend
            email: user.Email || "N/A"
          },
          flashcardScore,
          quizScore,
          totalScore: flashcardScore + quizScore
        };
      });

    leaderboard.sort((a, b) => b.totalScore - a.totalScore);

    res.json({ leaderboard: leaderboard.slice(0, 10) });

  } catch (error) {
    console.error("Leaderboard Error:", error);
    res.status(500).json({ error: "Failed to generate leaderboard." });
  }
};
