const { Server } = require("socket.io");
const { verifyAccessToken } = require("../utils/jwt");
const config = require("./index");

let io = null;

/**
 * Call once at server startup with the http.Server instance returned by
 * app.listen(). Sets up JWT-authenticated socket connections, each joining
 * a room named `user:<userId>` so events can be targeted at specific users
 * (organizer + participants) instead of broadcast to everyone.
 */
function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: config.clientUrl || "*",
            credentials: true,
        },
    });

    io.use((socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace("Bearer ", "");

            if (!token) return next(new Error("Authentication required"));

            const payload = verifyAccessToken(token);
            const userId = payload.id;
            if (!userId) return next(new Error("Invalid token payload"));

            socket.userId = userId;
            next();
        } catch (err) {
            next(new Error("Authentication failed"));
        }
    });

    io.on("connection", (socket) => {
        socket.join(`user:${socket.userId}`);
    });

    console.log("[socket] Socket.IO initialized");
    return io;
}

function getIO() {
    if (!io) {
        throw new Error("Socket.IO not initialized — call initSocket() before using it.");
    }
    return io;
}

/**
 * Emits `event` with `payload` to each given user's room. Safe to call even
 * if Socket.IO failed to init or a user has no active connection — errors
 * are logged, never thrown, so a socket failure can't break meeting CRUD.
 */
function emitToUsers(event, payload, userIds) {
    try {
        const io = getIO();
        [...new Set(userIds)].forEach((userId) => {
            io.to(`user:${userId}`).emit(event, payload);
        });
    } catch (err) {
        console.error(`[socket] Failed to emit "${event}":`, err.message);
    }
}

module.exports = { initSocket, getIO, emitToUsers };