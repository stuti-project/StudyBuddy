const mongoose = require('mongoose');
const {isEmail}=require("validator");

const userSchema = new mongoose.Schema({
    ProfilePicture: { 
        type: String, 
        default: null
     },
    FullName: {
        type: String,
        required: true
    },
    UserName: {
        type: String,
        required: true,
        unique: true
    },
    Email: {
        type: String,
        required: true,
        unique: true,
        validate:[isEmail,'please enter valid email']
    },
    Password:{
        type: String,
        required: true,
    },
    Country:{
        type: String,
        required: true,
    },
    State:{
        type: String,
        required: true,
    },
    EducationLevel:{
        type: String,
        required: true,
    },
    Subject:{
        type: String,
        required: true,
    },
    StudyGoals:{
        type: String,
        required: true,
    }

}, { timestamps: true });

const User = mongoose.model("users", userSchema);
module.exports=User;