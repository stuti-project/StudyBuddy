const mongoose = require('mongoose');

const dbConnect = async ()=>{
    try{
        await mongoose.connect(process.env.MONGO_URL);
        console.log("connected");
    }catch(err){
        console.log("not connected"+ err );
    }
}

module.exports={dbConnect}