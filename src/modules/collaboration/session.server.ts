const io = require("socket.io")(3001, {
  cors: {
    // remember to change cors when deploy
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket: any) => {
  socket.on("send-code", (delta: any) => {
    socket.broadcast.emit("receive-code", delta);
  });
});
