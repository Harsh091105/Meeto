import { Server } from "socket.io";

/**
 * Custom WebRTC Signaling & State Management Server
 * Refactored to implement advanced peer tracking and optimized media state caching.
 */
let activePeerNetwork = {};
let roomMessageCache = {};
let peerConnectionTimestamps = {};
let clientIdentityMap = {};
let clientHardwareStateMap = {};

export const connectToSocket = (httpServer) => {
    const ioServer = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
        },
        transports: ["websocket", "polling"],
    });

    ioServer.on("connection", (clientSocket) => {
        console.log(`[Socket.io] New client connected: ${clientSocket.id}`);

        /**
         * Handle microphone hardware toggles and sync with the active mesh.
         */
        clientSocket.on("mic-status-change", (payload) => {
            const { socketId, isMicOn } = payload;
            if (clientHardwareStateMap[socketId]) {
                clientHardwareStateMap[socketId].isMicOn = isMicOn;
            } else {
                clientHardwareStateMap[socketId] = { isMicOn, isCamOn: true };
            }
            clientSocket.broadcast.emit("mic-status-change", payload);
        });

        /**
         * Handle camera hardware toggles and sync with the active mesh.
         */
        clientSocket.on("cam-status-change", (payload) => {
            const { socketId, isCamOn } = payload;
            if (clientHardwareStateMap[socketId]) {
                clientHardwareStateMap[socketId].isCamOn = isCamOn;
            } else {
                clientHardwareStateMap[socketId] = { isMicOn: true, isCamOn };
            }
            clientSocket.broadcast.emit("cam-status-change", payload);
        });

        /**
         * Core initialization pipeline for new peers joining a room.
         */
        clientSocket.on("join-call", (roomIdentifier, alias, hardwareDefaults) => {
            if (alias) {
                clientIdentityMap[clientSocket.id] = alias;
            }
            
            clientHardwareStateMap[clientSocket.id] = { 
                isMicOn: hardwareDefaults?.isMicOn ?? true, 
                isCamOn: hardwareDefaults?.isCamOn ?? true 
            };

            if (!activePeerNetwork[roomIdentifier]) {
                activePeerNetwork[roomIdentifier] = [];
            }
            activePeerNetwork[roomIdentifier].push(clientSocket.id);
            peerConnectionTimestamps[clientSocket.id] = Date.now();

            // Construct state snapshot for all peers currently in the room
            const currentRoomState = activePeerNetwork[roomIdentifier].reduce((acc, peerId) => {
                acc[peerId] = {
                    username: clientIdentityMap[peerId] || peerId,
                    isMicOn: clientHardwareStateMap[peerId]?.isMicOn ?? true,
                    isCamOn: clientHardwareStateMap[peerId]?.isCamOn ?? true
                };
                return acc;
            }, {});

            // Broadcast the new peer event to everyone in this room
            activePeerNetwork[roomIdentifier].forEach((peerId) => {
                ioServer.to(peerId).emit("user-joined", clientSocket.id, activePeerNetwork[roomIdentifier], currentRoomState);
            });

            // Dispatch cached messages to the newly joined peer
            if (roomMessageCache[roomIdentifier]) {
                roomMessageCache[roomIdentifier].forEach((cachedMsg) => {
                    ioServer.to(clientSocket.id).emit("chat-message",
                        cachedMsg.data,
                        cachedMsg.sender,
                        cachedMsg.socketIdSender
                    );
                });
            }
        });

        /**
         * WebRTC SDP & ICE Candidate signaling relay.
         */
        clientSocket.on("signal", (targetPeerId, signalPayload) => {
            ioServer.to(targetPeerId).emit("signal", clientSocket.id, signalPayload);
        });

        /**
         * Handle instantaneous bi-directional text chat within rooms.
         */
        clientSocket.on("chat-message", (messageData, senderAlias) => {
            const currentRoom = Object.keys(activePeerNetwork).find(room => 
                activePeerNetwork[room].includes(clientSocket.id)
            );

            if (currentRoom) {
                if (!roomMessageCache[currentRoom]) {
                    roomMessageCache[currentRoom] = [];
                }
                
                roomMessageCache[currentRoom].push({ 
                    sender: senderAlias, 
                    data: messageData, 
                    socketIdSender: clientSocket.id 
                });

                activePeerNetwork[currentRoom].forEach((peerId) => {
                    ioServer.to(peerId).emit("chat-message", messageData, senderAlias, clientSocket.id);
                });
            }
        });

        /**
         * Teardown and memory cleanup pipeline upon peer disconnection.
         */
        clientSocket.on("disconnect", () => {
            Object.keys(activePeerNetwork).forEach((roomKey) => {
                const peerIndex = activePeerNetwork[roomKey].indexOf(clientSocket.id);
                
                if (peerIndex !== -1) {
                    activePeerNetwork[roomKey].forEach((peerId) => {
                        ioServer.to(peerId).emit('user-left', clientSocket.id);
                    });

                    activePeerNetwork[roomKey].splice(peerIndex, 1);

                    if (activePeerNetwork[roomKey].length === 0) {
                        delete activePeerNetwork[roomKey];
                        delete roomMessageCache[roomKey]; // Clean up memory
                    }
                }
            });
            
            // Clean up global maps
            delete clientIdentityMap[clientSocket.id];
            delete clientHardwareStateMap[clientSocket.id];
            delete peerConnectionTimestamps[clientSocket.id];
        });
    });

    return ioServer;
}
export default connectToSocket;