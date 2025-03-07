const mongoose = require('mongoose');
const User = require('../model/reg');
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');


const userRegistration = async (req, res) => {
    try {
        const { FullName, UserName, Email, Password, ConfirmPassword, Country, State, EducationLevel, Subject, StudyGoals } = req.body;
        
        const existingUser = await User.findOne({ Email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already in use" });
        }

        const hashedPassword = await bcrypt.hash(Password, 10);
        const ProfilePicture = req.file ? `uploads/images/${req.file.filename}` : null;

        const newUser = new User({
            ProfilePicture, FullName, UserName, Email, Password: hashedPassword, ConfirmPassword, Country, State, EducationLevel, Subject, StudyGoals
        });

        await newUser.save();

        // 🔹 Generate Token
        const token = jwt.sign({ _id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

        // 🔹 Send Token & User Data to Frontend
        return res.status(200).json({ message: "Success", token, user: newUser });

    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};


const userLogin = async (req, res) => {
    try {
        const { Email, Password } = req.body;
        const userFound = await User.findOne({ Email });
        if (!userFound) {
            return res.status(400).json({ message: "Invalid email or password" });
        }
        
        const pwdMatch = await bcrypt.compare(Password, userFound.Password);
        if (!pwdMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // 🔹 Correct JWT_SECRET variable
        const token = jwt.sign({ _id: userFound._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

        // 🔹 Send Token & User Data to Frontend
        return res.status(200).json({ message: "Login success", token, user: userFound });

    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};



module.exports = { userRegistration,userLogin };

