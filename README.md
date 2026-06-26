# Meeto: Next-Gen Video Collaboration
A completely custom-built, full-stack web application engineered for instant, decentralized video conferencing using advanced WebRTC and Socket.io pipelines.

## Project Overview
Meeto was developed from the ground up to solve the complexities of real-time communication. Rather than relying on third-party video APIs, this platform handles raw media streams directly in the browser, offering users an ultra-low latency environment to host meetings, share screens, and exchange text messages. The architecture prioritizes data privacy, instant state reflection, and seamless media hardware management.

## Core Capabilities
* **Peer-to-Peer Media Routing:** Leverages native WebRTC APIs to establish direct browser-to-browser connections, drastically reducing latency for video and audio transmission.
* **Instantaneous Text Chat:** Integrated a customized Socket.io event loop to power a lightning-fast, bidirectional chat room that operates in parallel with the video streams.
* **Live Room State Engine:** Built a centralized memory layer on the Node.js server that perfectly synchronizes hardware statuses (like who is currently muted or hiding their camera) the exact moment a new participant enters the lobby.
* **Cryptographic Meeting Security:** Dropped traditional URL guessing by implementing a MongoDB-backed verification layer. Every meeting code is cryptographically validated via a REST API before any media permissions are even requested.
* **Smart Device Caching:** Programmed the client-side React app to remember user hardware preferences using `sessionStorage`, ensuring your microphone and camera settings survive accidental page reloads.
* **Fluid Interface Design:** Crafted a fully adaptive UI from scratch. The interface intelligently morphs between desktop grid layouts and stacked mobile views without sacrificing usability.

## Technology Blueprint
| Architecture Layer | Core Tools & Frameworks |
| --- | --- |
| **Client-Side** | React.js, React Router, CSS3 Flexbox/Grid, Vanilla JS |
| **Server-Side** | Node.js, Express.js |
| **Database Ecosystem** | MongoDB, Mongoose ODM |
| **Real-Time Web** | Socket.io (WebSocket), WebRTC (`RTCPeerConnection`) |
| **Security & Auth** | bcrypt (password hashing), crypto, custom session management |
| **Dev Environment** | cors, dotenv, nodemon |

## Key Engineering Milestones
* **Decentralized Mesh Networking:** Successfully engineered a multi-node WebRTC mesh topology. By handling ICE candidate negotiation and SDP (Session Description Protocol) handshakes manually, the app supports multi-party calls without bottlenecking a central media server.
* **Eradicating "Late-Joiner" Desync:** Solved a notorious WebRTC state bug where newly connected users see incorrect UI states. I fixed this by packing comprehensive "State Profiles" directly into the initial Socket connection payloads.
* **Dynamic Track Swapping:** Wrote logic to instantly hot-swap active `MediaStream` tracks on the fly. This allows users to switch between webcam feeds and screen sharing without ever tearing down and rebuilding the underlying peer connection.
* **Pre-Mount Authorization:** Secured the React component lifecycle by enforcing backend API validation *before* the video interface is allowed to render, instantly kicking out unauthorized viewers.
* **Environment Isolation:** Shielded all proprietary database connections and server secrets using strict environment variable parsing (`dotenv`).

## Run It Locally

**1. Pull the Source Code:**
```bash
git clone https://github.com/Harsh091105/Meeto.git
cd Meeto
```

**2. Boot up the Backend:**
Open your terminal and step into the server directory:
```bash
cd backend
npm install
```
Create a hidden `.env` file inside the `backend` folder and link your MongoDB cluster:
```env
MONGO_URI=your_personal_mongodb_connection_string
PORT=8080
```
Launch the server environment:
```bash
npm run dev
```

**3. Launch the Frontend UI:**
Open a brand new terminal tab and step into the client directory:
```bash
cd frontend
npm install
```
Fire up the React development server:
```bash
npm run dev
```

Your browser should automatically open, or you can manually navigate to `http://localhost:5173` to start your first meeting!
