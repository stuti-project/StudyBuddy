const Task = require("../model/todo");

// Add Task
const inserttask = async (req, res) => {
    const { title, description, status, dueDate } = req.body;

    const newTask = new Task({
        userEmail: req.user.email,
        title,
        description,
        status,
        dueDate
    });
    try {
        const savedTask = await newTask.save();
        res.status(201).json({ message: "Task added successfully", task: savedTask });
    } catch (error) {
        console.error("❌ Error inserting task:", error);
        res.status(500).json({ message: "Error inserting task", error });
    }
};

// Get User's Tasks
const gettask = async (req, res) => {
    const tasks = await Task.find({ userEmail: req.user.email });
    res.status(200).json(tasks);
};

// Update Task
const updatetask = async (req, res) => {
    const { title, description, status, dueDate } = req.body;

    const updatedTask = await Task.findOneAndUpdate(
        { _id: req.params.id, userEmail: req.user.email },
        { title, description, status, dueDate },
        { new: true }
    );

    if (!updatedTask) return res.status(404).json({ error: "Task not found" });

    res.status(200).json({ message: "Task updated successfully", task: updatedTask });
};

// Delete Task
const deletetask = async (req, res) => {
    const deletedTask = await Task.findOneAndDelete({
        _id: req.params.id,
        userEmail: req.user.email
    });

    if (!deletedTask) return res.status(404).json({ error: "Task not found" });

    res.status(200).json({ message: "Task deleted successfully" });
};

module.exports = { inserttask, gettask, updatetask, deletetask };
