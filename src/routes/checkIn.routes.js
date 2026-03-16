import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  dailyCheckIn,
  getDailyCheckInStatus,
  habitCheckIn,
  getTodayHabitStatuses,
  goalCheckIn,
  getCheckInHistory,
} from "../controllers/checkIn.controller.js";

const router = Router();

// All routes require auth
router.use(verifyJWT);

// ── Daily (homepage check-in button) ──
router.post  ("/daily",        dailyCheckIn);
router.get   ("/daily/status", getDailyCheckInStatus);

// ── Habit ──
router.post  ("/habit/:habitId", habitCheckIn);
router.get   ("/habit/today",    getTodayHabitStatuses);

// ── Goal ──
router.post  ("/goal/:goalId",   goalCheckIn);

// ── History (contribution graph) ──
router.get   ("/history",        getCheckInHistory);

export default router;