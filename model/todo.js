const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
    userEmail: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ["Backlog", "ToDo", "In Progress", "Completed"], required: true },
    dueDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Task", taskSchema);
