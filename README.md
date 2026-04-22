# Real-Time Video Conferencing Platform

A high-performance, full-stack web application engineered for ultra-low latency, peer-to-peer (P2P) video and audio communication. This platform leverages WebRTC for direct media transport and a custom Socket.io signaling server for seamless connection management.

## 🚀 Features

* **Ultra-Low Latency Media Streaming:** Utilizes WebRTC for direct P2P audio and video transmission, bypassing traditional server relays for near-instant communication.
* **Dynamic Room Management:** A custom bi-directional signaling server manages concurrent user connections, dynamic room generation, and real-time state synchronization across all participants.
* **Secure Authentication:** Robust user authentication pipeline using Bcrypt for password hashing and Node's native Crypto module for secure session tokens.
* **Responsive, High-Performance UI:** Built with React and Vite for blazing-fast Hot Module Replacement (HMR) during development and highly optimized asset bundling for production.
* **Persistent Data Storage:** Securely persists user profiles, room metadata, and authentication states within a MongoDB NoSQL database.

## 🛠️ Tech Stack

**Frontend:**
* React.js
* Vite (Bundler)
* Axios (REST API communication)
* Custom CSS (Responsive video grid architecture)

**Backend:**
* Node.js & Express.js
* Socket.io (WebSocket signaling server)
* WebRTC (P2P media transport & NAT traversal via ICE)
* Bcrypt & Crypto (Security & Hashing)

**Database:**
* MongoDB (Atlas)
* Mongoose (ODM)

## ⚙️ Architecture Overview

1. **Signaling Phase:** When a user joins a room, the React client connects to the Node.js/Socket.io server. The server acts as a middleman to exchange SDP (Session Description Protocol) offers, answers, and ICE candidates between peers.
2. **P2P Connection:** Once signaling is complete, a direct WebRTC `RTCPeerConnection` is established between the browsers.
3. **Media Transport:** Video and audio tracks are captured via the browser's `getUserMedia` API and streamed directly between peers, ensuring maximum privacy and minimum latency.

## 💻 Getting Started

### Prerequisites
Make sure you have the following installed on your local machine:
* [Node.js](https://nodejs.org/) (v16 or higher)
* [Git](https://git-scm.com/)
* A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (or local MongoDB instance)

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/YourUsername/YourRepositoryName.git](https://github.com/YourUsername/YourRepositoryName.git)
   cd YourRepositoryName
