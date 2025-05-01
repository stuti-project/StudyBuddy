const { Server } = require("socket.io");
const http = require("http");
const express = require("express");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["https://study-buddy-frontend-six.vercel.app/"],
  }
});

const userSocketMap = {}; // { userId: socketId }

const getReceiverSocketId = (userId) => {
  return userSocketMap[userId] || null;
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Call user - Emit incoming call to the receiver
  socket.on("call-user", ({ to, from, signal }) => {
    const socketId = getReceiverSocketId(to);
    if (socketId) {
      io.to(socketId).emit("incoming-call", { from, signal });
    }
  });

  // Answer call - Emit call accepted signal to the caller
  socket.on("answer-call", ({ to, signal }) => {
    const socketId = getReceiverSocketId(to);
    if (socketId) {
      io.to(socketId).emit("call-accepted", signal); // Signal is WebRTC data
    }
  });

  // Audio call request - Emit audio call to receiver
  socket.on("audio-call-request", ({ to, from }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("incoming-audio-call", { from });
    }
  });

  // End call - Notify the other user that the call ended
  socket.on("end-call", ({ to }) => {
    const socketId = getReceiverSocketId(to);
    if (socketId) {
      io.to(socketId).emit("call-ended");    
    }
    socket.emit("call-ended");              
  });
  
  socket.on("reject-call", ({ to }) => {
    const socketId = getReceiverSocketId(to);
    if (socketId) {
      io.to(socketId).emit("call-rejected");
    }
  });

  socket.on("disconnect", () => {
    if (userId) {
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

module.exports = { io, app, server, getReceiverSocketId };