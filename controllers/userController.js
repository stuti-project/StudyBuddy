const mongoose = require('mongoose');
const User = require('../model/reg');
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');


const userRegistration = async (req, res) => {
    try {
        const { FullName, UserName, Email, Password, ConfirmPassword, Country, State, EducationLevel, Subject, StudyGoals } = req.body;
        const hashedPassword = await bcrypt.hash(Password, 10);

        // Check if a file was uploaded
        const ProfilePicture = req.file ? `uploads/images/${req.file.filename}` : null;

        const newUser = new User({
            ProfilePicture,
            FullName,
            UserName,
            Email,
            Password: hashedPassword,
            ConfirmPassword,
            Country,
            State,
            EducationLevel,
            Subject,
            StudyGoals
        });

        await newUser.save();
        return res.status(200).json({ message: "Success", user: newUser });

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
            return res.status(400).json({ "mesage": "Invalid email or pwd" });
        }
        // console.log(userFound);
        const pwdMatch = await bcrypt.compare(Password, userFound.Password);
        // console.log(pwdMatch)
        if (!pwdMatch) {
            return res.status(400).json({ "mesage": "Invalid email or pwd" });
        }

        const token = jwt.sign({ _id: userFound._id  }, process.env.jwt_secret, { expiresIn: "1d" });

        res.cookie("token", token);
        return res.status(200).json({ "messgae": "login success" });

    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
}


module.exports = { userRegistration,userLogin };

