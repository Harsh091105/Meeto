import React from 'react';
import './landing.css';
import { Link } from 'react-router-dom';

import heroBg from '../images/landingpage1.png'; 
import videoPreview from '../images/tablet.png';

const LandingPage = () => {
  return (
    <div className="landing-container">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="logo">Meeto</div>
        <div className="nav-links">
          <button className="btn-secondary">Join as Guest</button>
          <Link to="/register" className="btn-secondary">Register</Link>
          <Link to="/login" className="btn-primary">Login</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="overlay">
          <div className="hero-content">
            <h1>Connect through video calls</h1>
            <p className="subtitle">Anytime, Anywhere</p>
            <p className="description">Seamless communication, powered by Meeto.</p>
            
            <div className="video-card">
              <img src={videoPreview} alt="Video Call Interface" className="ui-img" />
            </div>

            <button className="btn-get-started">Get Started</button>
          </div>
        </div>
      </header>
    </div>
  );
};

export default LandingPage;