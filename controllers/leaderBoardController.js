const Users = require("../model/reg");
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

    // Get all users
    const allUsers = await Users.find({}, "_id UserName Email");

    // Get all progress records
    const allProgress = await Progress.find({});

    const progressMap = {};
    allProgress.forEach(progress => {
      if (progress.userId) {
        progressMap[progress.userId.toString()] = progress.flashcardsCompleted || 0;
      }
    });

    // Build the leaderboard from all users
    const leaderboard = allUsers.map(user => {
      const userIdStr = user._id.toString();
      const flashcardScore = progressMap[userIdStr] || 0;
      const quizScore = quizMap[userIdStr] || 0;

      return {
        user: {
          name: user.UserName || "Unknown",
          email: user.Email || "N/A"
        },
        flashcardScore,
        quizScore,
        totalScore: flashcardScore + quizScore
      };
    });

    // Sort by total score in descending order
    leaderboard.sort((a, b) => b.totalScore - a.totalScore);

    // Return top 10 (or fewer if less than 10 users)
    res.json({ leaderboard: leaderboard.slice(0, 10) });

  } catch (error) {
    console.error("Leaderboard Error:", error);
    res.status(500).json({ error: "Failed to generate leaderboard." });
  }
};
