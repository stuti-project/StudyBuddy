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
            ProfilePicture,FullName,UserName,Email,Password: hashedPassword,ConfirmPassword,Country,State,EducationLevel,Subject,StudyGoals
        });

        await newUser.save();

        const token = jwt.sign({ _id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.cookie("token", token, { httpOnly: true }); 

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
        
        const pwdMatch = await bcrypt.compare(Password, userFound.Password);
        if (!pwdMatch) {
            return res.status(400).json({ "mesage": "Invalid email or pwd" });
        }

        const token = jwt.sign({ _id: userFound._id  }, process.env.jwt_secret, { expiresIn: "1d" });
        res.cookie("token", token, { httpOnly: true }); 
        
        return res.status(200).json({ "messgae": "login success" });

    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
}


module.exports = { userRegistration,userLogin };

