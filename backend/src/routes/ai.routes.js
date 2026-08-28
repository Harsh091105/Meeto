import { Router } from "express";
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const router=Router();
const groq=new Groq({apiKey:process.env.GROQ_API_KEY});

router.post("/ask", async(req, res)=>{
    try{
        const {prompt}=req.body;

        const chatCompletion =await groq.chat.completions.create({
            messages:[
                {role:"system", content:"You are a helpful AI Meeting Co-Pilot. Keep your answers brief and concise since they are being displayed in a live chat box."},

                {role:"user", content:prompt}
            ],
            model: "qwen/qwen3.8-27b",
        });

        const aiText=chatCompletion.choices[0]?.message?.content || "No response";

        return res.status(200).json({answer : aiText});

    }catch(error){
        console.error("AI Error :",error);
        return res.status(500).json({answer :"Sorry, I am having trouble connecting right now."});
    }
});
export default router;
