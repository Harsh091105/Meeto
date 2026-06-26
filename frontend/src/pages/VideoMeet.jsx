import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";
import axios from "axios";
import "./VideoMeet.css";

import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import CallEndIcon from "@mui/icons-material/CallEnd";
import ChatIcon from "@mui/icons-material/Chat";

const server_url = "http://localhost:8080";
const activePeerNetwork = {};
const peerConfigConnections = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

let blackTrack = null;
let silentTrack = null;
let currentVideoTrack = null;
let localCamTrack = null;

/* ---------- Track Helpers ---------- */
const createBlackTrack = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.captureStream(5).getVideoTracks()[0];
};

const createSilentTrack = () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    const track = dst.stream.getAudioTracks()[0];
    track.enabled = false;
    return track;
};

// Video component to prevent flickering on re-renders
const RemoteVideo = ({ video }) => {
    const videoRef = useRef();

    useEffect(() => {
        const playStream = () => {
            if (videoRef.current && video.stream) {
                videoRef.current.srcObject = null; // Clear it to force the browser to re-evaluate the tracks
                videoRef.current.srcObject = video.stream;
                videoRef.current.play().catch(e => console.warn("Autoplay prevented:", e));
            }
        };

        playStream();

        if (video.stream) {
            video.stream.onaddtrack = () => {
                playStream();
            };
        }
    }, [video.stream]);

    return (
        <div className="videoBox">
            <video autoPlay playsInline ref={videoRef} />
            <span className="nameTag">{video.username || video.socketId}</span>
            <div className="micIndicator" style={{ display: 'flex', gap: '5px' }}>
                {video.isMicOn ? <MicIcon /> : <MicOffIcon className="muted" />}
                {video.isCamOn ? <VideocamIcon /> : <VideocamOffIcon className="muted" />}
            </div>
        </div>
    );
};

export default function VideoMeetComponent() {
    const navigate = useNavigate();
    const { url } = useParams();
    const socketRef = useRef();
    const socketIdRef = useRef();
    const localVideoRef = useRef();

    const [videos, setVideos] = useState([]);
    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState("");
    const [isMicOn, setIsMicOn] = useState(() => sessionStorage.getItem("meeto_mic") !== "false");
    const [isCamOn, setIsCamOn] = useState(() => sessionStorage.getItem("meeto_cam") !== "false");
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");

    const getPermissions = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            window.localStream = stream;
            localCamTrack = stream.getVideoTracks()[0];
            
            const audioTrack = stream.getAudioTracks()[0];
            const initialMic = sessionStorage.getItem("meeto_mic") !== "false";
            const initialCam = sessionStorage.getItem("meeto_cam") !== "false";
            
            if (audioTrack && !initialMic) {
                audioTrack.enabled = false;
            }
            
            if (localCamTrack && !initialCam) {
                localCamTrack.enabled = false;
                if (!blackTrack) blackTrack = createBlackTrack();
                currentVideoTrack = blackTrack;
            } else {
                currentVideoTrack = localCamTrack;
            }

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error getting media permissions:", err);
        }
    };

    /**
     * WebRTC SDP & ICE Candidate signaling processor.
     * Parses the incoming socket relay and injects candidates into the local peer connection.
     */
    const processIncomingSignalingPayload = async (senderIdentity, payloadData) => {
        const parsedSignal = JSON.parse(payloadData);
        if (senderIdentity === socketIdRef.current) return;
        
        const peerInstance = activePeerNetwork[senderIdentity];
        if (!peerInstance) return;

        if (parsedSignal.sdp) {
            await peerInstance.setRemoteDescription(new RTCSessionDescription(parsedSignal.sdp));
            if (parsedSignal.sdp.type === "offer") {
                const answerPayload = await peerInstance.createAnswer();
                await peerInstance.setLocalDescription(answerPayload);
                socketRef.current.emit("signal", senderIdentity, JSON.stringify({ sdp: peerInstance.localDescription }));
            }
        }
        if (parsedSignal.ice) {
            await peerInstance.addIceCandidate(new RTCIceCandidate(parsedSignal.ice));
        }
    };

    const initializeRealtimeMesh = () => {
        const activeAlias = sessionStorage.getItem("meeto_username") || username || "User";
        socketRef.current = io.connect(server_url);
        socketRef.current.on("signal", processIncomingSignalingPayload);

        socketRef.current.on("chat-message", (data, sender, senderId) => {
            setMessages(prev => [
                ...prev,
                {
                    text: data,
                    sender: sender,
                    senderId: senderId,
                    time: new Date().toLocaleTimeString()
                }
            ]);
        });


        socketRef.current.on("mic-status-change", ({ socketId, isMicOn }) => {
            setVideos((prev) => prev.map((v) => v.socketId === socketId ? { ...v, isMicOn } : v));
        });

        socketRef.current.on("cam-status-change", ({ socketId, isCamOn }) => {
            setVideos((prev) => prev.map((v) => v.socketId === socketId ? { ...v, isCamOn } : v));
        });

        socketRef.current.on("connect", () => {
            socketIdRef.current = socketRef.current.id;
            
            // Pass the exact initial states directly in the join-call payload
            socketRef.current.emit("join-call", window.location.href, currentUsername, {
                isMicOn: sessionStorage.getItem("meeto_mic") !== "false",
                isCamOn: sessionStorage.getItem("meeto_cam") !== "false"
            });
            
            
            socketRef.current.on("user-left", (id) => {
                if (activePeerNetwork[id]) activePeerNetwork[id].close();
                delete activePeerNetwork[id];
                setVideos((v) => v.filter((video) => video.socketId !== id));
            });

            socketRef.current.on("user-joined", (id, clients, roomUsers) => {
                clients.forEach((socketListId) => {
                    if (!activePeerNetwork[socketListId]) {
                        const pc = new RTCPeerConnection(peerConfigConnections);
                        activePeerNetwork[socketListId] = pc;

                        pc.onicecandidate = (event) => {
                            if (event.candidate)
                                socketRef.current.emit("signal", socketListId, JSON.stringify({ ice: event.candidate }));
                        };

                        pc.ontrack = (event) => {
                            const remoteStream = event.streams[0];
                            setVideos((prev) => {
                                if (prev.find((v) => v.socketId === socketListId)) return prev;
                                
                                // Safely extract state from roomUsers if it exists
                                const remoteUserData = (roomUsers && roomUsers[socketListId]) ? roomUsers[socketListId] : null;
                                const remoteUsername = remoteUserData ? remoteUserData.username : socketListId;
                                const remoteIsMicOn = remoteUserData ? remoteUserData.isMicOn : true;
                                const remoteIsCamOn = remoteUserData ? remoteUserData.isCamOn : true;
                                
                                return [...prev, { socketId: socketListId, stream: remoteStream, isMicOn: remoteIsMicOn, isCamOn: remoteIsCamOn, username: remoteUsername }];
                            });
                        };

                        const audioTrack = window.localStream.getAudioTracks()[0];
                        if (audioTrack) pc.addTrack(audioTrack, window.localStream);
                        if (currentVideoTrack) pc.addTrack(currentVideoTrack, window.localStream);
                    }
                });

                if (id === socketIdRef.current) {
                    for (let id2 in activePeerNetwork) {
                        if (id2 === socketIdRef.current) continue;
                        const pc = activePeerNetwork[id2];
                        if (pc.signalingState !== "stable") continue;
                        pc.createOffer()
                            .then((desc) => pc.setLocalDescription(desc))
                            .then(() => socketRef.current.emit("signal", id2, JSON.stringify({ sdp: pc.localDescription })));
                    }
                }
            });
        });
    };

    const connect = async () => {
        if (!username.trim()) {
            alert("Please enter a username to join the lobby.");
            return;
        }
        sessionStorage.setItem("meeto_username", username);
        setAskForUsername(false);
        await getPermissions();
        initializeRealtimeMesh();
    };

    /* ---------- MIC TOGGLE ---------- */
   const toggleMic = () => {
  const audioTrack = window.localStream.getAudioTracks()[0];
  const newState = !audioTrack.enabled;
  audioTrack.enabled = newState;

  setIsMicOn(newState);
  sessionStorage.setItem("meeto_mic", newState);

  socketRef.current.emit("mic-status-change", {
    socketId: socketIdRef.current,
    isMicOn: newState
  });
};


    /* ---------- CAMERA TOGGLE ---------- */
    const toggleCamera = () => {
        const videoTrack = window.localStream.getVideoTracks()[0];
        const turningOff = videoTrack.enabled;
        videoTrack.enabled = !turningOff;
        if (!blackTrack) blackTrack = createBlackTrack();

        Object.values(activePeerNetwork).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender) sender.replaceTrack(turningOff ? blackTrack : videoTrack);
        });

        setIsCamOn(!turningOff);
        sessionStorage.setItem("meeto_cam", !turningOff);

        socketRef.current.emit("cam-status-change", {
            socketId: socketIdRef.current,
            isCamOn: !turningOff
        });
    };

    /* ---------- SCREEN SHARE ---------- */
    const toggleScreenShare = async () => {
        if (!isScreenSharing) {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];

            currentVideoTrack = screenTrack;
            
            // Update local video element
            const newLocalStream = new MediaStream([currentVideoTrack, window.localStream.getAudioTracks()[0]]);
            localVideoRef.current.srcObject = newLocalStream;

            // Update existing connections
            Object.values(activePeerNetwork).forEach((pc) => {
                const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                if (sender) sender.replaceTrack(screenTrack);
            });

            // When user clicks "Stop Sharing" on the browser popup
            screenTrack.onended = () => {
                currentVideoTrack = localCamTrack;
                const restoredStream = new MediaStream([currentVideoTrack, window.localStream.getAudioTracks()[0]]);
                localVideoRef.current.srcObject = restoredStream;

                Object.values(activePeerNetwork).forEach((pc) => {
                    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                    if (sender) sender.replaceTrack(localCamTrack);
                });
                setIsScreenSharing(false);
            };

            setIsScreenSharing(true);
        }
    };

    const endCall = () => {
        Object.values(activePeerNetwork).forEach((pc) => pc.close());
        for (let key in activePeerNetwork) delete activePeerNetwork[key];
        if (socketRef.current) socketRef.current.disconnect();
        
        // Turn off camera and mic
        if (window.localStream) {
            window.localStream.getTracks().forEach((track) => track.stop());
        }
        
        // Remove from session storage so auto-rejoin doesn't trigger
        sessionStorage.removeItem("meeto_username");
        sessionStorage.removeItem("meeto_mic");
        sessionStorage.removeItem("meeto_cam");
        
        navigate("/"); // Redirect to landing page
    };

    const sendMessage = () => {
        if (!chatInput.trim()) return;

        socketRef.current.emit("chat-message", chatInput, username || "User");

        setChatInput("");
    };



    useEffect(() => {
        let isMounted = true;

        const validateRoom = async () => {
            try {
                const response = await axios.get(`http://localhost:8080/api/v1/meetings/validate/${url}`);
                if (response.status === 200) {
                    const storedUsername = sessionStorage.getItem("meeto_username");
                    
                    if (storedUsername) {
                        setUsername(storedUsername);
                        setAskForUsername(false);
                        const init = async () => {
                            await new Promise(resolve => setTimeout(resolve, 100));
                            if (!isMounted) return;
                            await getPermissions();
                            if (!isMounted) return;
                            connectToSocketServer();
                        };
                        init();
                    }
                }
            } catch (error) {
                alert("Invalid Meeting Code.");
                navigate("/");
            }
        };

        validateRoom();

        return () => {
            isMounted = false;
            Object.values(activePeerNetwork).forEach((pc) => pc.close());
            for (let key in activePeerNetwork) delete activePeerNetwork[key];
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    return (
        <div>
            {askForUsername ? (
                <div className="lobby-container">
                    <div className="lobby-content">
                        <h2>Enter Lobby</h2>
                        <div className="lobby-code-box">
                            <p>Meeting Code: <strong>{url}</strong></p>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(url);
                                    alert("Meeting code copied to clipboard!");
                                }} 
                                className="copy-btn"
                            >
                                Copy Code
                            </button>
                        </div>
                        <input className="lobby-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your Name" />
                        <button className="lobby-connect-btn" onClick={connect}>Connect</button>
                    </div>
                    <div className="lobby-video-preview">
                        <video ref={localVideoRef} autoPlay muted playsInline />
                    </div>
                </div>
            ) : (
                <>
                    <div className="controlBar">
                        <button onClick={toggleMic} className="controlBtn">
                            {isMicOn ? <MicIcon /> : <MicOffIcon />}
                        </button>

                        <button onClick={toggleCamera} className="controlBtn">
                            {isCamOn ? <VideocamIcon /> : <VideocamOffIcon />}
                        </button>

                        <button onClick={toggleScreenShare} className="controlBtn">
                            <ScreenShareIcon />
                        </button>

                        <button onClick={() => setIsChatOpen(prev => !prev)} className="controlBtn chatBtn">
                            <ChatIcon />
                            <span className="chatBadge">{messages.length}</span>
                        </button>


                        <button onClick={endCall} className="controlBtn endCall">
                            <CallEndIcon />
                        </button>
                    </div>

                    {isChatOpen && (
                        <div className="chatPanel">
                            <div className="chatHeader">Meeting Chat</div>

                            <div className="chatMessages">
                                {messages.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`chatMsg ${msg.senderId === socketIdRef.current ? "myMsg" : ""}`}
                                    >
                                        <strong>{msg.sender}</strong>
                                        <span className="time">{msg.time}</span>
                                        <p>{msg.text}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="chatInputBox">
                                <input
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder="Type message..."
                                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                                />
                                <button onClick={sendMessage}>Send</button>
                            </div>
                        </div>
                    )}


                    <div className="videoGrid">
                        <div className="videoBox">
                            <video ref={localVideoRef} autoPlay muted />
                            <span className="nameTag">You</span>
                            <div className="micIndicator" style={{ display: 'flex', gap: '5px' }}>
                                {isMicOn ? <MicIcon /> : <MicOffIcon className="muted" />}
                                {isCamOn ? <VideocamIcon /> : <VideocamOffIcon className="muted" />}
                            </div>
                        </div>

                        {videos.map((v) => (
                            <RemoteVideo key={v.socketId} video={v} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
