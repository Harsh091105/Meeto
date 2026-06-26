import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

/**
 * Controller: Authenticates user credentials against the MongoDB cluster.
 * Uses bcrypt for secure password comparison and crypto for randomized session token generation.
 * 
 * @param {Object} req - The standard Express request payload.
 * @param {Object} res - The standard Express response emitter.
 */
const authenticateClient = async (req, res) => {
    const { username: loginIdentifier, password: rawPassword } = req.body;
    
    // Immediate rejection of malformed requests
    if (!loginIdentifier|| !rawPassword) {
        return res.status(400).json({message: "Incomplete login credentials provided."});
    }
    
    try {
        const clientRecord =await User.findOne({ username: loginIdentifier });
        
        // Obfuscate whether the username or the password was incorrect for security
        if (!clientRecord) {
            return res.status(httpStatus.NOT_FOUND).json({message:"Authentication failure."});
        }
        
        const isPasswordValid= await bcrypt.compare(rawPassword, clientRecord.password);
        
        if (isPasswordValid) {
            // Generate a secure 20-byte hex token for session persistence
            const sessionKey = crypto.randomBytes(20).toString("hex");
            clientRecord.token= sessionKey;
            
            await clientRecord.save();
            return res.status(httpStatus.OK).json({ token:sessionKey });
        } else {
            return res.status(httpStatus.UNAUTHORIZED).json({message: "Authentication failure." });
        }

    } catch (authError) {
        return res.status(500).json({ message: `Fatal Authentication Exception: ${authError.message}` });
    }
};

/**
 * Controller: Handles the registration and cryptographic hashing of new user accounts.
 */
const registerNewClient = async (req, res) => {
    const { name: fullName, username: requestedUsername, password: plainTextPassword } = req.body;

    try {
        const activeIdentity = await User.findOne({ username: requestedUsername });
        
        // Prevent duplicate identities
        if (activeIdentity) {
            return res.status(httpStatus.CONFLICT).json({ message: "Requested identity is already allocated." });
        }
        
        // Execute a 10-round bcrypt hash on the plaintext password
        const securedPasswordHash = await bcrypt.hash(plainTextPassword, 10);
        
        const newClientDocument = new User({
            name: fullName,
            username: requestedUsername,
            password: securedPasswordHash
        });
        
        await newClientDocument.save();
        return res.status(httpStatus.CREATED).json({ message: "Client registration successful." });
    } catch (registrationError) {
        return res.status(500).json({ message: `Fatal Registration Exception: ${registrationError.message}` });
    }
};

export { authenticateClient as login, registerNewClient as register };