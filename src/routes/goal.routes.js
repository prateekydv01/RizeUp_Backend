import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import {
  createGoal,
  getMyGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
  markGoalComplete,
  verifyProof,
  joinGoal,
  leaveGoal,
  getCircleGoals,
  getGoalLeaderboard,
  addDailyLog,
  getGoalLogs
} from "../controllers/goal.controller.js";

const router = Router();
router.use(verifyJWT);

// 🔥 specific routes first
router.get("/circle/:circleId", getCircleGoals);
router.get("/:goalId/leaderboard", getGoalLeaderboard);

router.post("/:goalId/join", joinGoal);
router.post("/:goalId/leave", leaveGoal);

router.post("/:goalId/complete",upload.single("proof"), markGoalComplete);
router.post("/:goalId/verify/:requestId", verifyProof);

router.post("/:goalId/logs", verifyJWT, addDailyLog);
router.get("/:goalId/logs", verifyJWT, getGoalLogs);

// 🧠 general CRUD
router.post("/", createGoal);
router.get("/", getMyGoals);
router.get("/:goalId", getGoalById);
router.patch("/:goalId", updateGoal);
router.delete("/:goalId", deleteGoal);

export default router;