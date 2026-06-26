import React, { useState } from 'react';
import './login.css';
import authBg from '../../images/landingpage1.png';
import { Link, useNavigate } from 'react-router-dom';
import axios from "axios"

const Login = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const response = await axios.post("http://localhost:8080/api/v1/users/login", {
        username: username,
        password: password
      });
      if (response.status == 200) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("username", username);
        alert("Login Successful! Welcome back.");
        navigate('/');
      }
    } catch (error) {
      console.log("Full Error Object:", error);
      const msg = error.response?.data?.message || "Login failed. Please check your credentials.";
      setErrorMessage(msg);

    } finally {
      setIsLoading(false);
    }
  }
  return (
    <div className="login-container" style={{ backgroundImage: `url(${authBg})` }}>
      <div className="login-overlay">
        <div className="login-card">
          <div className="login-header">
            <h2>Welcome Back</h2>
            <p>Login to join your meetings</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>

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

            <button
              type="submit"
              className="btn-login"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="login-footer">
            <p>
              Don't have an account?
              <Link to="/register"> Register</Link>
            </p>
          </div>
          <div className='back-link'>
            <Link to="/">← Back to Home</Link>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;