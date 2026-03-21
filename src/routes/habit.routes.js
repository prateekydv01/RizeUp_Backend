import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createHabit,
  getMyHabits,
  getHabitById,
  updateHabit,
  deleteHabit,
  joinHabit,
  leaveHabit,
  getCircleHabits,
  checkInHabit,
  getMyHabitGraph,
  getMembersGraph,
  linkHabitToCircle,
  unlinkHabitFromCircle,
} from "../controllers/habit.controller.js";

const router = Router();
router.use(verifyJWT);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post  ("/create",                 createHabit);
router.get   ("/my-habits",              getMyHabits);
router.get   ("/circle/:circleId",       getCircleHabits);
router.get   ("/:habitId",               getHabitById);
router.patch ("/update/:habitId",        updateHabit);
router.delete("/delete/:habitId",        deleteHabit);

// ── MEMBERSHIP ────────────────────────────────────────────────────────────────
router.post  ("/join/:habitId",          joinHabit);
router.patch ("/leave/:habitId",         leaveHabit);

// ── CIRCLE LINKING ────────────────────────────────────────────────────────────
router.patch ("/link-circle/:habitId",   linkHabitToCircle);
router.patch ("/unlink-circle/:habitId", unlinkHabitFromCircle);

// ── CHECK-IN & GRAPHS ─────────────────────────────────────────────────────────
router.post  ("/checkin/:habitId",       checkInHabit);
router.get   ("/graph/:habitId",         getMyHabitGraph);
router.get   ("/members-graph/:habitId", getMembersGraph);

export default router;