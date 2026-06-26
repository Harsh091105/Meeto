import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import userRoutes from "./routes/user.routes.js"
import meetingRoutes from "./routes/meeting.routes.js"
import {createServer} from "node:http";

import{connectToSocket} from "./controllers/socketManager.js";

const app=express();
const server=createServer(app);
const io=connectToSocket(server);

import dotenv from "dotenv";
dotenv.config();

app.set("port",(process.env.PORT||8080));
app.use(cors());
app.use(express.json({limit:"40kb"}));
app.use(express.urlencoded({limit:"40kb",extended:true}));

app.use("/api/v1/users",userRoutes);
app.use("/api/v1/meetings", meetingRoutes);

app.get("/", (req, res) => {
    return res.json({ "message": "Backend is up and running!" });
});

app.get("/home",(req,res)=>{
    return res.json({"hello":"world"})
});

const start = async () => {
  try {
    const connectionDb = await mongoose.connect(process.env.MONGO_URI);
    console.log(
      `MongoDB Connected: ${connectionDb.connection.host}`
    );
    server.listen(app.get("port"), () => {
      console.log(`Server running on port ${app.get("port")}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1); 
  }
};

start();