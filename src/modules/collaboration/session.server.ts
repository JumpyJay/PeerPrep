import { Server, Socket } from "socket.io";

// define a type for the payload from Quill
interface CodeDelta {
  ops: unknown[];
}

const io = new Server(3001, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket: Socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // listen for the client's request to join a room
  socket.on("join-session", (sessionId: number | string) => {
    const room = String(sessionId);
    socket.join(room);
    console.log(`[socket] ${socket.id} joined room ${room}`);
  });

  // listen for code changes
  socket.on("send-code", (delta: CodeDelta) => {
    // find the room this socket is in but must not be socket id
    const room = Array.from(socket.rooms).find((r) => r !== socket.id);

    if (room) {
      // broadcast change only to respective room
      socket.to(room).emit("receive-code", delta);
    } else {
      console.warn(`[socket] ${socket.id} sent code but is not in a room.`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});
