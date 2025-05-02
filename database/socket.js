const { Server } = require("socket.io");
const http = require("http");
const express = require("express");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "https://study-buddy-frontend-six.vercel.app",
      "http://localhost:3000", // Update with correct dev URL
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const userSocketMap = {};

const getReceiverSocketId = (userId) => {
  return userSocketMap[userId] || null;
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    userSocketMap[userId] = socket.id;
    io.emit("getOnlineUsers", Object.keys(userSocketMap)); // Emit online users after mapping
  }

  socket.on("call-user", ({ to, from, signal }) => {
    const socketId = getReceiverSocketId(to);
    if (socketId) {
      try {
        io.to(socketId).emit("incoming-call", { from, signal });
      } catch (err) {
        console.error("Error sending call:", err);
      }
    }
  });

  socket.on("audio-call-request", ({ to, from }) => {
    const socketId = getReceiverSocketId(to);
    if (socketId) {
      io.to(socketId).emit("incoming-audio-call", { from });
    }
  });

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
