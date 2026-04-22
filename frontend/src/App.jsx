import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css'
import LandingPage from './pages/landing'
import Login from './pages/auth/login'
import Register from './pages/auth/register';
import VideoMeetComponent from './pages/VideoMeet';
function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path='/' element={<LandingPage />}></Route>
          <Route path='/login' element={<Login/>}></Route>
          <Route path='/register' element={<Register/>}></Route>
          <Route path='/:url' element={<VideoMeetComponent/>}></Route>
        </Routes>
      </Router>
    </div>
  )
}

export default App
