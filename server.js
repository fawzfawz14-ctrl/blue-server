import { Server } from "socket.io";

const PORT = process.env.PORT || 3000;

const io = new Server(PORT, {
  cors: { origin: "*" }
});

console.log(`🚀 Blue Server is running on port ${PORT}`);

// كائن لتخزين بيانات الأعضاء داخل كل غرفة صوتية
// الشكل: { "Lobby": [ { id, username, avatar } ], "Gaming Room": [ ... ] }
const voiceRooms = {};

// مصفوفة لحفظ تاريخ الشات والرسومات حتى لا تختفي أبداً عند إعادة الإقلاع أو دخول شخص جديد
const messageHistory = [];

// دالة مساعدة لإرسال التحديثات لجميع المتصلين
function broadcastVoiceRooms() {
  io.emit("update_voice_rooms", voiceRooms);
}

// دالة لإزالة المستخدم من أي غرفة صوتية كان متواجداً فيها
function removeUserFromVoice(socketId) {
  let updated = false;
  for (const roomName in voiceRooms) {
    const originalLength = voiceRooms[roomName].length;
    voiceRooms[roomName] = voiceRooms[roomName].filter(user => user.id !== socketId);
    if (voiceRooms[roomName].length !== originalLength) {
      updated = true;
    }
    // تنظيف الغرفة إذا أصبحت فارغة
    if (voiceRooms[roomName].length === 0) {
      delete voiceRooms[roomName];
    }
  }
  if (updated) {
    broadcastVoiceRooms();
  }
}

io.on("connection", (socket) => {
  console.log(`✅ A user connected: ${socket.id}`);

  // إرسال الحالة الحالية للغرف الصوتية للمستخدم الجديد فور اتصاله
  socket.emit("update_voice_rooms", voiceRooms);

  // إرسال تاريخ الرسائل والرسومات القديمة للمستخدم الجديد فور اتصاله
  socket.emit("load_history", messageHistory);

  // استقبال الرسائل والرسومات وحفظها في الذاكرة
  socket.on("send_message", (data) => {
    messageHistory.push(data);
    
    // حد أقصى للرسائل (مثلاً آخر 150 رسالة) لكي يبقى السيرفر خفيفاً وسريعاً
    if (messageHistory.length > 150) {
      messageHistory.shift();
    }

    io.emit("receive_message", data);
  });

  // الانضمام للغرفة الصوتية (يدعم الكائن الجديد أو الاسم القديم)
  socket.on("join_voice_room", (data) => {
    let roomName = "";
    let username = "User";
    let avatar = "";

    if (typeof data === "object" && data !== null) {
      roomName = data.room;
      username = data.username || "User";
      avatar = data.avatar || "";
    } else {
      roomName = data;
    }

    if (!roomName) return;

    // إذا كان المستخدم في غرفة سابقة، نحذفه منها أولاً
    removeUserFromVoice(socket.id);

    socket.join(roomName);
    socket.roomName = roomName;

    // إضافة المستخدم لقائمة الغرفة الصوتية
    if (!voiceRooms[roomName]) {
      voiceRooms[roomName] = [];
    }
    
    voiceRooms[roomName].push({
      id: socket.id,
      username: username,
      avatar: avatar
    });

    // إشعار باقي المتواجدين في الغرفة لإجراء اتصال WebRTC
    socket.to(roomName).emit("user_joined_voice", socket.id);

    // إرسال التحديث للجميع لتظهر الصورة والاسم تحت القناة الصوتية
    broadcastVoiceRooms();
  });

  // إشارات WebRTC للصوت
  socket.on("voice_offer", ({ target, offer }) => {
    io.to(target).emit("voice_offer", { sender: socket.id, offer });
  });

  socket.on("voice_answer", ({ target, answer }) => {
    io.to(target).emit("voice_answer", { sender: socket.id, answer });
  });

  socket.on("ice_candidate", ({ target, candidate }) => {
    io.to(target).emit("ice_candidate", { sender: socket.id, candidate });
  });

  // مغادرة الغرفة الصوتية
  socket.on("leave_voice_room", (roomName) => {
    socket.leave(roomName);
    socket.to(roomName).emit("user_left_voice", socket.id);
    removeUserFromVoice(socket.id);
    socket.roomName = null;
  });

  // عند قطع الاتصال
  socket.on("disconnect", () => {
    if (socket.roomName) {
      socket.to(socket.roomName).emit("user_left_voice", socket.id);
    }
    removeUserFromVoice(socket.id);
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});
