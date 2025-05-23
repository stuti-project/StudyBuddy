const { dbConnect } = require("./database/db");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { app, server } = require("./database/socket");
const path = require('path')
console.log("hello");
app.use(
    cors({
      origin: "*", 
      methods: "GET,POST,PUT,DELETE",
      allowedHeaders: "Content-Type,Authorization",
    })
  ); 

app.use(express.json());
app.use(express.urlencoded({extended:false}));

dbConnect();
// Import Routes
const userRouter = require("./routes/userRoutes");
const flashcardRoutes = require("./routes/flashcardRoutes");
const todoRoutes = require("./routes/todoRoutes");
const messageRoutes= require("./routes/messageRoutes");
const quizRoutes= require("./routes/quizRoutes");

const progressRoutes = require("./routes/progressRoutes");
const leaderboardRoutes = require("./routes/leaderBoardRoutes")
app.use('/', leaderboardRoutes)
app.use("/progress", progressRoutes);



app.use("/user", userRouter);
app.use("/user", flashcardRoutes);
app.use("/user", todoRoutes);
app.use("/user",messageRoutes);
app.use("/quiz",quizRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const port = process.env.PORT;

server.listen(port,()=>{
    console.log(`listing port no. ${port}`);
});