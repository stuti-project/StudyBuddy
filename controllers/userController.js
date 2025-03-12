const mongoose = require('mongoose');
const User = require('../model/reg');
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require("crypto");

let resetCodes = {}; // Store reset codes in memory (temporary)

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "Loaded" : "Not Loaded");

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false // ✅ Ignore self-signed certificates
    }
});


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

        const token = jwt.sign({ _id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

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

        const token = jwt.sign({ _id: userFound._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

        return res.status(200).json({ message: "Login success", 
            token,
            user: {
                ProfilePicture: userFound.ProfilePicture,
                UserName: userFound.UserName
            }});

    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

const sendResetCode = async (req, res) => {
    try {
        const { Email } = req.body;
        const user = await User.findOne({ Email });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        // Generate a 6-digit reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        resetCodes[Email] = { code: resetCode, expires: Date.now() + 10 * 60 * 1000 }; // Valid for 10 min

        console.log("Sending reset code to:", Email);
        console.log("Generated reset code:", resetCode);

        // Send email
        const mailOptions = {
            from: `"Study Buddy Team" <${process.env.EMAIL_USER}>`,
            to: Email,
            subject: "Password Reset Code",
            text: `Your reset code is: ${resetCode}. It expires in 10 minutes.`
        };

        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully!");

        res.status(200).json({ message: "Reset code sent successfully" });

    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


// **Step 2: Verify Reset Code**
const verifyResetCode = async (req, res) => {
    try {
        const { Email, resetCode } = req.body;

        if (!resetCodes[Email] || resetCodes[Email].code !== resetCode || resetCodes[Email].expires < Date.now()) {
            return res.status(400).json({ message: "Invalid or expired code" });
        }

        delete resetCodes[Email]; // Remove code after verification
        res.status(200).json({ message: "Code verified successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// **Step 3: Reset Password**
const resetPassword = async (req, res) => {
    try {
        const { Email, newPassword } = req.body;
        const user = await User.findOne({ Email });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.Password = hashedPassword;
        await user.save();

        res.status(200).json({ message: "Password updated successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { userRegistration, userLogin, sendResetCode, verifyResetCode, resetPassword };
