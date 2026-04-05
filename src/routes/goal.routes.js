import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
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
  getGoalLeaderboard
} from "../controllers/goal.controller.js";

const router = Router();
router.use(verifyJWT);

// 🔥 specific routes first
router.get("/circle/:circleId", getCircleGoals);
router.get("/:goalId/leaderboard", getGoalLeaderboard);

router.post("/:goalId/join", joinGoal);
router.post("/:goalId/leave", leaveGoal);

router.post("/:goalId/complete", markGoalComplete);
router.post("/:goalId/verify/:requestId", verifyProof);

// 🧠 general CRUD
router.post("/", createGoal);
router.get("/", getMyGoals);
router.get("/:goalId", getGoalById);
router.patch("/:goalId", updateGoal);
router.delete("/:goalId", deleteGoal);

export default router;