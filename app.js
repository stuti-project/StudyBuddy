const { dbConnect } = require("./database/db");
const dotenv = require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());
app.use(express.urlencoded({extended:false}));

dbConnect();
const userRouter = require('./routes/userRoutes');
app.use("/user",userRouter);

app.use("/uploads", express.static("uploads"));

const port = process.env.PORT;

app.listen(port,()=>{
    console.log(`listing port no. ${port}`);
});