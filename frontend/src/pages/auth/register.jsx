import React, { useState } from "react";

import axios from "axios";
import './register.css';
import regBg from '../../images/landingpage1.png';
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
    const navigate = useNavigate();

    const [fullName, setFullName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);


    const handleSignUp = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setIsLoading(true);
        try {
            const response = await axios.post("https://meeto-8b38.onrender.com/api/v1/users/register",
                {
                    name: fullName,
                    username: username,
                    password: password
                }
            );
            if (response.status === 201 || response.status === 200) {
                alert("Registration Successful! Redirecting to Login...");
                navigate('/login');
            }

        } catch (error) {
            console.log("Full Error Object:", error);
            const msg = error.response?.data?.message || "Registration failed. Please check your credentials.";
            setErrorMessage(msg);
        }
        finally {
            setIsLoading(false);
        }

    }
    return (
        <div className="reg-container" style={{ backgroundImage: `url(${regBg})` }}>
            <div className="reg-overlay">
                <div className="reg-card">
                    <div className="reg-header">
                        <h2>Create Account </h2>
                        <p>Start your journey with Meeto</p>
                    </div>
                    <form className="reg-form" onSubmit={handleSignUp}>
                        <div className="input-group">
                            <input type="text" placeholder="Full Name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                        </div>
                        <div className="input-group">
                            <input type="text" placeholder="Username" required value={username} onChange={(e) => setUsername(e.target.value)} />
                        </div>
                        <div className="input-group">
                            <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                        </div>
                        {errorMessage && (
                            <div className="error-display">
                                ⚠️ {errorMessage}
                            </div>
                        )}
                        <button type="submit" className="btn-reg" disabled={isLoading}>
                            {isLoading?"Signing Up..." : "Sign Up"}
                        </button>
                    </form>
                    <div className="reg-footer">
                        <p>
                            Already have an account?
                            <Link to="/login"> Login</Link>
                        </p>
                    </div>
                    <div className='back-link'>
                        <Link to="/">← Back to Home</Link>
                    </div>

                </div>
            </div>
        </div>
    );
}
