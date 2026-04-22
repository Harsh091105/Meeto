import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import "./VideoMeet.css";

import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import CallEndIcon from "@mui/icons-material/CallEnd";
import ChatIcon from "@mui/icons-material/Chat";

const server_url = "http://localhost:8080";
const connections = {};
const peerConfigConnections = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

let blackTrack = null;
let silentTrack = null;

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

export default function VideoMeetComponent() {
    const socketRef = useRef();
    const socketIdRef = useRef();
    const localVideoRef = useRef();

    const [videos, setVideos] = useState([]);
    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState("");
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");


    const getPermissions = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        window.localStream = stream;
        localVideoRef.current.srcObject = stream;
    };

    const gotMessageFromServer = async (fromId, message) => {
        const signal = JSON.parse(message);
        if (fromId === socketIdRef.current) return;
        const pc = connections[fromId];
        if (!pc) return;

        if (signal.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            if (signal.sdp.type === "offer") {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socketRef.current.emit("signal", fromId, JSON.stringify({ sdp: pc.localDescription }));
            }
        }
        if (signal.ice) await pc.addIceCandidate(new RTCIceCandidate(signal.ice));
    };

    const connectToSocketServer = () => {
        socketRef.current = io.connect(server_url);
        socketRef.current.on("signal", gotMessageFromServer);

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

        socketRef.current.on("connect", () => {
            socketIdRef.current = socketRef.current.id;
            socketRef.current.emit("join-call", window.location.href);
            
            
            socketRef.current.on("user-left", (id) => {
                if (connections[id]) connections[id].close();
                delete connections[id];
                setVideos((v) => v.filter((video) => video.socketId !== id));
            });

            socketRef.current.on("user-joined", (id, clients) => {
                clients.forEach((socketListId) => {
                    if (!connections[socketListId]) {
                        const pc = new RTCPeerConnection(peerConfigConnections);
                        connections[socketListId] = pc;

                        pc.onicecandidate = (event) => {
                            if (event.candidate)
                                socketRef.current.emit("signal", socketListId, JSON.stringify({ ice: event.candidate }));
                        };

                        pc.ontrack = (event) => {
                            const remoteStream = event.streams[0];
                            setVideos((prev) => {
                                if (prev.find((v) => v.socketId === socketListId)) return prev;
                                return [...prev, { socketId: socketListId, stream: remoteStream, isMicOn: true }];
                            });
                        };

                        window.localStream.getTracks().forEach((track) => pc.addTrack(track, window.localStream));
                    }
                });

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue;
                        const pc = connections[id2];
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
        setAskForUsername(false);
        await getPermissions();
        connectToSocketServer();
    };

    /* ---------- MIC TOGGLE ---------- */
   const toggleMic = () => {
  const audioTrack = window.localStream.getAudioTracks()[0];
  const newState = !audioTrack.enabled;
  audioTrack.enabled = newState;

  setIsMicOn(newState);

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

        Object.values(connections).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender) sender.replaceTrack(turningOff ? blackTrack : videoTrack);
        });

        setIsCamOn(!turningOff);
    };

    /* ---------- SCREEN SHARE ---------- */
    const toggleScreenShare = async () => {
        if (!isScreenSharing) {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];

            Object.values(connections).forEach((pc) => {
                const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                if (sender) sender.replaceTrack(screenTrack);
            });

            screenTrack.onended = () => {
                const camTrack = window.localStream.getVideoTracks()[0];
                Object.values(connections).forEach((pc) => {
                    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                    if (sender) sender.replaceTrack(camTrack);
                });
                setIsScreenSharing(false);
            };

            setIsScreenSharing(true);
        }
    };

    const endCall = () => {
        Object.values(connections).forEach((pc) => pc.close());
        socketRef.current.disconnect();
        window.location.reload();
    };

    const sendMessage = () => {
        if (!chatInput.trim()) return;

        socketRef.current.emit("chat-message", chatInput, username || "User");

        setChatInput("");
    };



    useEffect(() => {
        return () => {
            Object.values(connections).forEach((pc) => pc.close());
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    return (
        <div>
            {askForUsername ? (
                <div>
                    <h2>Enter Lobby</h2>
                    <input value={username} onChange={(e) => setUsername(e.target.value)} />
                    <button onClick={connect}>Connect</button>
                    <video ref={localVideoRef} autoPlay muted />
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
                            <div className="micIndicator">{isMicOn ? <MicIcon /> : <MicOffIcon className="muted" />}</div>
                        </div>

                        {videos.map((v) => (
                            <div className="videoBox" key={v.socketId}>
                                <video autoPlay playsInline ref={(el) => el && (el.srcObject = v.stream)} />
                                <span className="nameTag">{v.socketId}</span>
                                <div className="micIndicator">{v.isMicOn ? <MicIcon /> : <MicOffIcon className="muted" />}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
