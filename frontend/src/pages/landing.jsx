import React, { useState, useEffect } from 'react';
import './landing.css';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

import heroBg from '../images/landingpage1.png'; 
import videoPreview from '../images/tablet.png';

/**
 * Component: Landing UI
 * Serves as the primary entry point for the application. Handles room code submission
 * and dynamically renders authenticated actions (Create Meeting) versus guest actions (Login/Register).
 */
const LandingPage = () => {
  const routerNavigate = useNavigate();
  const [targetRoomIdentifier, setTargetRoomIdentifier] = useState("");
  const [hasActiveSession, setHasActiveSession] = useState(false);

  // Evaluate local storage for a valid cryptographic session key on mount
  useEffect(() => {
    const cachedSessionKey = localStorage.getItem("token");
    if (cachedSessionKey !== null) {
      setHasActiveSession(true);
    }
  }, []);

  /**
   * Dispatches a REST validation request to ensure the requested room exists
   * before blindly redirecting the client to the WebRTC interface.
   */
  const initiateRoomJoinSequence = async () => {
    const sanitizedCode = targetRoomIdentifier.trim();
    if (sanitizedCode.length > 0) {
      try {
        const validationPayload = await axios.get(`https://meeto-8b38.onrender.com/api/v1/meetings/validate/${sanitizedCode}`);
        if (validationPayload.status === 200) {
          routerNavigate(`/${sanitizedCode}`);
        }
      } catch (networkError) {
        alert("Integrity Check Failed: Invalid or expired Meeting Code.");
      }
    } else {
      alert("Validation Error: Meeting code cannot be empty.");
    }
  };

  /**
   * Instructs the backend to provision a new MongoDB meeting record linked
   * to the current authenticated user's session token.
   */
  const provisionNewMeeting = async () => {
    try {
      const activeToken = localStorage.getItem("token");
      const creationResponse = await axios.post("https://meeto-8b38.onrender.com/api/v1/meetings/create", { token: activeToken });
      
      if (creationResponse.status === 201) {
        routerNavigate(`/${creationResponse.data.meetingCode}`);
      }
    } catch (provisionError) {
      alert("Fatal Error: Unable to provision a new meeting space. Try again later.");
    }
  };

  /**
   * Flushes the local storage cache and demotes the user back to guest status.
   */
  const terminateSession = () => {
    localStorage.clear(); // Safely clear all tokens and preferences
    setHasActiveSession(false);
  };

  return (
    <div className="landing-container">
      {/* Dynamic Authentication Navigation */}
      <nav className="navbar">
        <div className="logo">Meeto</div>
        <div className="nav-links">
          {hasActiveSession ? (
            <>
              <button className="btn-secondary" onClick={provisionNewMeeting}>Create Meeting</button>
              <button className="btn-primary" onClick={terminateSession}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/register" className="btn-secondary">Register</Link>
              <Link to="/login" className="btn-primary">Login</Link>
            </>
          )}
        </div>
      </nav>

      {/* Primary Interaction Section */}
      <header className="hero-section" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="overlay">
          <div className="hero-content">
            <h1>Connect through video calls</h1>
            <p className="subtitle">Anytime, Anywhere</p>
            <p className="description">Seamless communication, powered by Meeto.</p>
            
            <div className="join-box">
              <input 
                id="join-input"
                type="text" 
                placeholder="Enter Meeting Code" 
                value={targetRoomIdentifier}
                onChange={(e) => setTargetRoomIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && initiateRoomJoinSequence()}
              />
              <button className="btn-get-started" onClick={initiateRoomJoinSequence}>Join Meeting</button>
            </div>

            <div className="video-card">
              <img src={videoPreview} alt="Video Call Interface" className="ui-img" />
            </div>
          </div>
        </div>
      </header>
    </div>
  );
};

export default LandingPage;