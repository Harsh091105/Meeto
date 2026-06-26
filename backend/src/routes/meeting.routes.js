import {Router} from "express";
import {createMeeting, validateMeeting} from "../controllers/meeting.controller.js";

const router= Router();

router.post("/create",createMeeting);
router.get("/validate/:code",validateMeeting);

export default router;
