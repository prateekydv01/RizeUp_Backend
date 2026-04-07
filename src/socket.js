// socket.js — place in your backend src/ folder
// Usage: import { initSocket } from "./socket.js" and call initSocket(httpServer) in index.js

import { Server } from "socket.io";

// In-memory message store per circle (replace with DB in production)
const circleMessages = {};
const MAX_HISTORY    = 200;

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin:      process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {

    // ── Join circle room ──────────────────────────────────────────────────
    socket.on("join_circle", ({ circleId, userId, userName }) => {
      socket.join(circleId);
      socket.data.circleId = circleId;
      socket.data.userId   = userId;
      socket.data.userName = userName;

      // Send existing history to this client
      const history = circleMessages[circleId] || [];
      socket.emit("circle_history", history);
    });

    // ── New message ───────────────────────────────────────────────────────
    socket.on("circle_message", (msg) => {
      const { circleId } = msg;
      if (!circleId) return;

      // Store in memory
      if (!circleMessages[circleId]) circleMessages[circleId] = [];
      circleMessages[circleId].push(msg);

      // Keep only last MAX_HISTORY messages
      if (circleMessages[circleId].length > MAX_HISTORY) {
        circleMessages[circleId] = circleMessages[circleId].slice(-MAX_HISTORY);
      }

      // Broadcast to everyone in the room EXCEPT sender (sender already did optimistic update)
      socket.to(circleId).emit("circle_message", msg);
    });

    // ── Delete message ────────────────────────────────────────────────────
    socket.on("circle_delete_message", ({ id, circleId }) => {
      if (!circleId) return;

      // Remove from in-memory store
      if (circleMessages[circleId]) {
        circleMessages[circleId] = circleMessages[circleId].filter(m => m.id !== id);
      }

      // Broadcast deletion to everyone in the room including sender (other tabs)
      io.to(circleId).emit("circle_message_deleted", { id });
    });

    // ── Leave circle room ─────────────────────────────────────────────────
    socket.on("leave_circle", ({ circleId }) => {
      socket.leave(circleId);
    });

    socket.on("disconnect", () => {
      // cleanup handled by socket.io automatically
    });
  });

  return io;
};