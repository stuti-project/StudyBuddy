const { dbConnect } = require("./database/db");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const path = require('path')

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
const userRouter = require('./routes/userRoutes');
app.use("/user",userRouter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const port = process.env.PORT;

app.listen(port,()=>{
    console.log(`listing port no. ${port}`);
});