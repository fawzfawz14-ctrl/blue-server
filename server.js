import { Server } from "socket.io";

const PORT = process.env.PORT || 3000;

const io = new Server(PORT, {
  cors: { origin: "*" }
});

console.log(`🚀 Blue Server is running on port ${PORT}`);
console.log("🚀 Blue Server is running on port 3000");

io.on("connection", (socket) => {
  console.log(`✅ A user connected: ${socket.id}`);

  socket.on("send_message", (data) => {
    io.emit("receive_message", data);
  });

  socket.on("join_voice_room", (roomName) => {
    socket.join(roomName);
    socket.roomName = roomName;
    socket.to(roomName).emit("user_joined_voice", socket.id);
  });

  socket.on("voice_offer", ({ target, offer }) => {
    io.to(target).emit("voice_offer", { sender: socket.id, offer });
  });

  socket.on("voice_answer", ({ target, answer }) => {
    io.to(target).emit("voice_answer", { sender: socket.id, answer });
  });

  socket.on("ice_candidate", ({ target, candidate }) => {
    io.to(target).emit("ice_candidate", { sender: socket.id, candidate });
  });

  socket.on("leave_voice_room", (roomName) => {
    socket.leave(roomName);
    socket.to(roomName).emit("user_left_voice", socket.id);
  });

  socket.on("disconnect", () => {
    if (socket.roomName) {
      socket.to(socket.roomName).emit("user_left_voice", socket.id);
    }
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});