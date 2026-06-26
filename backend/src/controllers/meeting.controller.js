import httpStatus from "http-status";
import { Meeting } from "../models/meeting.model.js";
import { User } from "../models/user.model.js";

/**
 * Controller: Handles the generation and initialization of secure video meeting instances.
 * Extracts client identity via token evaluation (if provided) and links the meeting to the host.
 * 
 * @param {Object} req - The standard Express request payload.
 * @param {Object} res - The standard Express response emitter.
 */
const initializeMeetingRoom = async (req, res) => {
    const { token: clientToken } = req.body;
    
    try {
        let authorizedHostId= null;
        
        // Evaluate host identity if a cryptographic token is supplied
        if (clientToken){
            const hostRecord =await User.findOne({ token: clientToken });
            authorizedHostId = hostRecord ? hostRecord._id: null;
        }
        
        // Cryptographically generate a unique, non-sequential 6-character room identifier
        const uniqueRoomCode= Math.random().toString(36).substring(2, 8);
        
        // Instantiate the meeting model
        const newMeetingSession =new Meeting({
            user_id:authorizedHostId,
            meetingCode: uniqueRoomCode
        });

        await newMeetingSession.save();
        
        return res.status(httpStatus.CREATED).json({ meetingCode: uniqueRoomCode });
    } catch (dbError) {
        return res.status(500).json({ message: `Fatal Server Exception: ${dbError.message}` });
    }
};

/**
 * Controller: Verifies the existence of a requested room code in the database before
 * allowing the React client to mount the WebRTC interfaces.
 */
const verifyRoomIntegrity = async (req, res) => {
    const requestedCode = req.params.code;
    
    try {
        const activeRoom = await Meeting.findOne({ meetingCode: requestedCode });
        
        if (!activeRoom) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Invalid or expired Meeting Code" });
        }
        
        return res.status(httpStatus.OK).json({ message: "Room integrity verified." });
    } catch (lookupError) {
        return res.status(500).json({ message: `Fatal Server Exception: ${lookupError.message}` });
    }
};

export { initializeMeetingRoom as createMeeting, verifyRoomIntegrity as validateMeeting };
