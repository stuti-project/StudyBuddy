const { Server } = require("socket.io");
const http = require("http");
const express = require("express");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  }
});

const userSocketMap = {}; // { userId: socketId }

const getReceiverSocketId = (userId) => {
  return userSocketMap[userId] || null;
};

io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap[userId] = socket.id;
  
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  
    socket.on("disconnect", () => {
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
  });


module.exports = { io, app, server, getReceiverSocketId };
