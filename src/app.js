import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
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

app.use("/api/v1/user", userRouter);
app.use("/api/v1/todos", todoRouter);
app.use("/api/v1/todo-sections",sectionRouter );
app.use("/api/v1/circle",circleRouter);
app.use("/api/v1/goal",goalRouter);

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


export { app };
