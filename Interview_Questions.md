# Video Conferencing App - Interview Preparation Guide

This document contains the most important architectural decisions, bugs, and concepts related to your project. Review this before any technical interview.

## 1. Architectural Decisions & Trade-offs

### Q: Why did you choose a Peer-to-Peer (P2P) architecture instead of an SFU (Selective Forwarding Unit)?
**Answer:** 
"I deliberately chose a P2P architecture using WebRTC to prioritize maximum privacy—since P2P is end-to-end encrypted by default—and to keep server infrastructure costs practically at zero. I am fully aware of the trade-offs: P2P creates a mesh network, meaning my computer has to upload my video stream to every single participant individually. This limits the room size to about 4 to 5 people before CPU and bandwidth become bottlenecks. For my specific use case (small group meetings), P2P was the most efficient choice. If I were tasked with scaling this to a 50-person webinar, I would migrate the architecture to an SFU like LiveKit or Mediasoup, where clients upload their stream once and the server distributes it."

### Q: What is the role of Socket.io in your application?
**Answer:** 
"While the actual heavy video and audio data flows directly between the browsers via WebRTC, the browsers first need a way to find each other on the internet. I use a Node.js/Express backend running Socket.io strictly as a **Signaling Server**. It acts like a telephone operator, simply passing SDP (Session Description Protocol) offers, answers, and ICE candidates between User A and User B. Once that initial connection data is exchanged over WebSockets, the direct P2P connection takes over."

### Q: Why does the meeting disconnect completely if a user refreshes the page, and how can you fix or improve this?
**Answer:**
"Unlike standard HTTP requests which are **stateless**, WebRTC and WebSockets are **stateful** protocols. When a user joins a meeting, the browser actively holds a persistent WebSocket connection open in memory to listen for chat messages, and maintains a complex `RTCPeerConnection` object to stream video. 

When you hit 'Refresh' (F5), the browser completely destroys the current JavaScript environment to load the page from scratch. This instantly kills all active WebSockets and WebRTC connections, wiping them from memory. 

**The Solution (Auto-Rejoin):** While it is fundamentally impossible to prevent the network connection from dropping during a hard refresh, we can make the reconnection seamless. When a user clicks 'Connect' in the lobby, we can save their `username` and `roomId` into the browser's `sessionStorage`. When the React component mounts, we check `sessionStorage`. If the data exists, we automatically bypass the lobby screen, re-request camera permissions, and reconnect to the Socket server, putting them back in the call instantly without manual intervention."

---

## 2. Debugging & Performance

### Q: In your React frontend, why did the remote videos flicker every time you typed in the chat, and how did you fix it?
**Answer:** 
"This was a conflict between React's re-rendering lifecycle and the HTML5 Video API. Whenever I typed in the chat, it updated a React state (`chatInput`), which triggered a re-render of the main meeting component. 

Originally, the remote videos were rendered using an inline ref callback: `<video ref={(el) => el.srcObject = stream} />`. Because it was an inline function, React treated it as a brand new function on every keystroke, forcing the browser to re-assign the `srcObject`. Even though it was the exact same media stream, assigning `srcObject` forces the browser to reset video playback, causing a black flicker.

**The Fix:** I decoupled the video element from the parent's state updates by extracting it into a separate `<RemoteVideo />` child component. Inside that component, I used `useRef` to hold the video element, and a `useEffect` hook listening to the stream. Inside the effect, I added a conditional check: `if (videoRef.current.srcObject !== stream)` and only assigned it if it actually changed. This guaranteed the video playback remained perfectly smooth regardless of how many times the parent component re-rendered."

### Q: How did you debug the generic "Registration failed" error on the frontend?
**Answer:** 
"I encountered a bug where registering an already existing username caused a generic network error on the frontend instead of displaying my custom 'User already exists' message. 

Upon investigating the backend Node.js controller, I realized I was returning `res.status(302)` (HTTP FOUND) when a duplicate user was detected. In the context of a REST API, sending a 302 Redirect code causes the browser's HTTP client (Axios) to attempt a redirect, which fails and throws a silent network error, hiding the actual JSON message. 

I corrected this by changing the HTTP status code to **409 Conflict**, which is the proper RESTful standard for a resource that already exists. This allowed the frontend catch block to correctly parse the error and display the correct message."

### Q: Why did screen sharing break when a new user joined the room, and how did you fix it?
**Answer:**
"I encountered a bug where if Person A was sharing their screen, and Person B refreshed or joined late, Person B would see Person A's camera instead of their screen share. 

This happened because my `toggleScreenShare` function was only replacing the video track on *existing* `RTCPeerConnection` objects. When Person B joined, my Socket.io 'user-joined' event listener dynamically created a *new* `RTCPeerConnection` using the global `window.localStream`. Because I hadn't mutated `window.localStream` to include the screen track, it defaulted to sending the camera.

**The Fix:** Initially, I tried actively mutating `window.localStream` by removing the camera track and adding the screen track. However, directly mutating an active `MediaStream` causes inconsistent browser behavior in WebRTC (like silent stalls). Instead, I refactored the architecture to use a global `currentVideoTrack` variable. When `toggleScreenShare` is called, it updates `currentVideoTrack` and replaces the `srcObject` of the local video element with a freshly constructed `MediaStream`. When a new user joins, the Socket event explicitly grabs `currentVideoTrack` and adds it to the new `RTCPeerConnection`, guaranteeing the new peer reliably gets the correct video stream without mutating the original stream."

### Q: Why did the "End Call" button trap users in an infinite loop after implementing Auto-Rejoin, and what is the proper way to tear down a WebRTC connection?
**Answer:**
"After implementing the `sessionStorage` Auto-Rejoin feature, clicking 'End Call' caused the user to instantly rejoin the meeting. This happened because my original `endCall` function simply called `window.location.reload()`. Since `sessionStorage` survives a page reload, the app saw the saved session and immediately pulled the user back into the call!

To properly fix this, I rewrote the `endCall` function to perform a complete, graceful teardown:
1. I closed all `RTCPeerConnection` objects.
2. I explicitly disconnected the Socket.io connection.
3. **Crucially**, I looped through the `window.localStream` tracks and called `track.stop()` to properly release the user's camera and microphone hardware (turning off the camera light).
4. I cleared the `meeto_username` from `sessionStorage` to prevent the auto-rejoin loop.
5. I used React Router's `navigate('/')` to seamlessly return the user to the landing page without a hard refresh."

---

## 3. Security

### Q: How are you handling user authentication securely?
**Answer:**
"I never store plain-text passwords in the database. When a user registers, I use the **Bcrypt** library to salt and hash their password before saving it to MongoDB. During login, I use Bcrypt's `compare` function to verify the credentials. Once verified, I use Node's native `crypto` module to generate a secure, random 20-character session token, which is sent back to the client to manage their active session."

### Q: How do you handle frontend authentication state and protected UI elements in React without a state management library?
**Answer:**
"For simple applications, we can leverage the browser's `localStorage`. When a user successfully authenticates via the API, the backend returns a secure token (e.g., a cryptographically secure hex string), which the React frontend stores in `localStorage`. We then use a `useEffect` hook in our components (like the Landing Page) to check for the presence of this token on mount. Based on this, we update a boolean state variable (e.g., `isLoggedIn`) to conditionally render protected UI elements, such as 'Create Meeting' or 'Logout' buttons, instead of 'Login' or 'Register' buttons. This provides a fast, synchronous way to persist sessions across page reloads without the overhead of Redux or Context API."

### Q: How did you secure your meetings to prevent random people from guessing URLs and joining fake rooms?
**Answer:**
"I implemented database-backed meeting verification. When a logged-in user clicks 'Create Meeting', the frontend makes a POST request to the backend. The backend generates a secure alphanumeric room code, saves it in a MongoDB `Meeting` collection (associated with the user's ID), and returns the code.

To prevent uninvited guests from joining random or fake rooms, I added a validation layer on both the Join Input Box and the Video Meeting component itself. When the `VideoMeet` component mounts, it immediately fires an API request to `GET /api/v1/meetings/validate/:code`. If the code doesn't exist in the database, the backend returns a 404 error, and the React frontend catches this to forcefully redirect the unauthorized user back to the home page."

### Q: Why did you experience missing audio in WebRTC initially, and how did you solve the playback issue?
**Answer:**
"A common pitfall with WebRTC and React is that `MediaStream` tracks arrive asynchronously. When the remote `RTCPeerConnection` fires the `ontrack` event, the initial stream might only contain the video track. Later, the browser dynamically injects the audio track into that same `MediaStream` object reference. Because the object reference doesn't change, React doesn't trigger a re-render. 

Even though the `<video>` element has the `autoPlay` attribute, it doesn't automatically evaluate newly injected audio tracks if the component is already mounted. To solve this, I decoupled the `srcObject` assignment into a `useEffect` hook and explicitly forced `videoRef.current.play()` every time the stream data mutated. This guaranteed that the browser forcefully evaluated the complete stream and initiated both audio and video playback, completely fixing the silent audio issue."

### Q: How did you implement real-time username visibility instead of just displaying Socket IDs?
**Answer:**
"In Socket.io, connections are identified by a random hash (the `socket.id`). Since this isn't human-readable, I needed a way to link frontend user profiles to their backend socket connections. 

I updated the `join-call` event on the Node.js backend to accept a `username` payload from the frontend. The server maintains an in-memory dictionary mapping `socket.id -> username`. When a new user joins a room, the backend builds a dictionary of all users currently in that specific room and broadcasts it via the `user-joined` event. The React frontend receives this dictionary, updates its state, and maps the correct username to the corresponding remote video tile."

### Q: How do you handle state synchronization for late-joiners in WebRTC rooms (e.g., ensuring a new user knows who is already muted)?
**Answer:**
"A classic WebSocket bug occurs when a user mutes their microphone, but a late-joining user sees them as unmuted because the late-joiner initializes their React state with default values (`isMicOn: true`).

To solve this, I centralized the media state on the backend. In my Node.js socket server, I created a `userMediaStatus` memory object that tracks the live mic and camera boolean states for every active `socket.id`. Whenever a user toggles their hardware, they emit a `mic-status-change` or `cam-status-change` event, which the backend intercepts to update the `userMediaStatus` dictionary before broadcasting the change. 

Crucially, when a late-joining user connects, the backend doesn't just send a list of IDs. It constructs a complete 'State Profile' for every user in the room, bundling their `username`, `isMicOn`, and `isCamOn` properties. The late-joiner's React app unpacks this payload during the initial WebRTC track-binding phase, ensuring their UI perfectly mirrors the live state of the room from the very first frame."

### Q: Your video conferencing app worked perfectly on localhost but completely broke when deployed to Render — participants couldn't see each other and chat didn't work. What caused this and how did you fix it?
**Answer:**
"This was a multi-layered deployment bug caused by three issues working together:

**1. CORS Misconfiguration (Backend):** My Socket.IO server had `credentials: true` combined with `origin: '*'`. Per the CORS specification, when `Access-Control-Allow-Credentials` is `true`, the `Access-Control-Allow-Origin` header **cannot** be a wildcard `*` — it must be a specific origin. Browsers silently reject this combination. On localhost, CORS doesn't apply (same-origin), so this never surfaced. Once deployed cross-origin (frontend on `meeto-fwoh.onrender.com`, backend on `meeto-backend.onrender.com`), the browser blocked Socket.IO's HTTP polling handshake, preventing the WebSocket connection from ever establishing.

**2. Transport Mismatch:** Socket.IO defaults to HTTP long-polling for its initial handshake before upgrading to WebSocket. On cloud platforms like Render, this polling can be unreliable due to proxy timeouts and load balancer configurations. By explicitly setting `transports: ['websocket']` on both the client and server, we bypass the fragile polling phase entirely and connect via WebSocket directly.

**3. Undefined Function Reference:** The auto-reconnect code path called `connectToSocketServer()`, a function that didn't exist — the actual function was `initializeRealtimeMesh()`. This caused a silent `ReferenceError` crash in the reconnect flow, meaning any user who refreshed the page could never rejoin the room.

The fix involved removing `credentials: true` from the Socket.IO CORS config, forcing WebSocket transport on both sides, and fixing the function reference. This is a textbook example of why local testing alone is insufficient — cross-origin behavior, transport negotiation, and reconnection flows must be validated in a production-like environment."
