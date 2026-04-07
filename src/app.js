import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { initSocket } from "./socket.js";

const app = express();
const httpServer = createServer(app);   // wrap express in http server
const io         = initSocket(httpServer);

const allowedOrigins = process.env.CORS_ORIGIN
  ?.split(",")
  .map(o => o.trim().replace(/\/$/, ""));

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/$/, "");

      if (
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.includes("localhost")
      ) {
        return callback(null, true);
      } else {
        console.log("❌ Blocked by CORS:", origin);
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

import userRouter from "./routes/user.routes.js";
import todoRouter from "./routes/todo.routes.js"
import sectionRouter from "./routes/section.routes.js"
import circleRouter from "./routes/circle.routes.js"
import goalRouter from "./routes/goal.routes.js"
import checkInRouter from "./routes/checkIn.routes.js";
import googleRouter from "./routes/google.routes.js"
import habitRouter from "./routes/habit.routes.js"

app.use("/api/v1/user", userRouter);
app.use("/api/v1/todos", todoRouter);
app.use("/api/v1/todo-sections",sectionRouter );
app.use("/api/v1/circle",circleRouter);
app.use("/api/v1/goals",goalRouter);
app.use("/api/v1/checkin", checkInRouter);
app.use("/api/v1/google", googleRouter)
app.use("/api/v1/habits", habitRouter)


app.use((err, req, res, next) => {
  console.log("🔥 REAL ERROR OBJECT 🔥");
  console.log(err);               
  console.log(err.message);
  console.log(err.stack);

  res.status(500).json({
    success: false,
    message: err.message,
  });
});


export { httpServer };
