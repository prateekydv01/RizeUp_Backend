import { CheckIn } from "../models/checkIn.model.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// ── helpers ───────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

// ── Daily Check-In ────────────────────────────────────────────────────────────

export const dailyCheckIn = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const today  = todayStr();

  // Prevent double check-in
  const existing = await CheckIn.findOne({
    userId,
    entityType: "stage",
    entityId: userId,
    date: today,
  });

  if (existing) {
    const user = await User.findById(userId).select("streak lastCheckInDate");
    return res
      .status(200)
      .json(new ApiResponse(200, { alreadyCheckedIn: true, streak: user.streak }, "Already checked in today"));
  }

  // ── Update streak on User ──────────────────────────────────────────────────
  const user = await User.findById(userId).select("streak lastCheckInDate");

  let newStreak;
  if (user.lastCheckInDate === yesterdayStr()) {
    // Consecutive day — increment
    newStreak = (user.streak || 0) + 1;
  } else if (user.lastCheckInDate === today) {
    // Same day somehow — keep
    newStreak = user.streak;
  } else {
    // Missed a day or first ever — reset to 1
    newStreak = 1;
  }

  user.streak          = newStreak;
  user.lastCheckInDate = today;
  await user.save({ validateBeforeSave: false });

  // ── Save CheckIn record ───────────────────────────────────────────────────
  const checkIn = await CheckIn.create({
    userId,
    entityType: "stage",
    entityId: userId,
    date: today,
    completed: true,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { checkedIn: true, streak: newStreak, checkIn }, "Daily check-in recorded"));
});

// ── Get today's daily check-in status ────────────────────────────────────────

export const getDailyCheckInStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const today  = todayStr();

  const [checkIn, user] = await Promise.all([
    CheckIn.findOne({ userId, entityType: "stage", entityId: userId, date: today }),
    User.findById(userId).select("streak lastCheckInDate"),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      checkedIn: !!checkIn,
      streak: user.streak,
      lastCheckInDate: user.lastCheckInDate,
    }, "Status fetched")
  );
});

// ── Habit Check-In ────────────────────────────────────────────────────────────

export const habitCheckIn = asyncHandler(async (req, res) => {
  const userId      = req.user._id;
  const { habitId } = req.params;
  const today       = todayStr();

  const existing = await CheckIn.findOne({
    userId, entityType: "habit", entityId: habitId, date: today,
  });

  if (existing) {
    await existing.deleteOne();
    return res.status(200).json(new ApiResponse(200, { checkedIn: false }, "Habit check-in removed"));
  }

  const checkIn = await CheckIn.create({
    userId, entityType: "habit", entityId: habitId, date: today, completed: true,
  });

  return res.status(201).json(new ApiResponse(201, { checkedIn: true, checkIn }, "Habit checked in"));
});

// ── Get today's habit check-in statuses (batch) ───────────────────────────────

export const getTodayHabitStatuses = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const today  = todayStr();

  const checkIns = await CheckIn.find({ userId, entityType: "habit", date: today });
  const map = {};
  checkIns.forEach(c => { map[c.entityId.toString()] = true; });

  return res.status(200).json(new ApiResponse(200, map, "Today's habit statuses fetched"));
});

// ── Goal Check-In ─────────────────────────────────────────────────────────────

export const goalCheckIn = asyncHandler(async (req, res) => {
  const userId     = req.user._id;
  const { goalId } = req.params;
  const { proofUrl } = req.body;
  const today      = todayStr();

  const existing = await CheckIn.findOne({
    userId, entityType: "goal", entityId: goalId, date: today,
  });

  if (existing) {
    await existing.deleteOne();
    return res.status(200).json(new ApiResponse(200, { checkedIn: false }, "Goal check-in removed"));
  }

  const checkIn = await CheckIn.create({
    userId, entityType: "goal", entityId: goalId,
    date: today, completed: true,
    proofUrl: proofUrl || undefined,
  });

  return res.status(201).json(new ApiResponse(201, { checkedIn: true, checkIn }, "Goal checked in"));
});

// ── Check-in history for contribution graph ───────────────────────────────────

export const getCheckInHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { entityType, entityId, days = 105 } = req.query;

  if (!entityType || !entityId) throw new ApiError(400, "entityType and entityId are required");

  const start = new Date();
  start.setDate(start.getDate() - Number(days));

  const checkIns = await CheckIn.find({
    userId, entityType, entityId,
    date: { $gte: start.toISOString().slice(0, 10), $lte: todayStr() },
  }).select("date completed");

  const dates = checkIns.filter(c => c.completed).map(c => c.date);

  return res.status(200).json(new ApiResponse(200, dates, "Check-in history fetched"));
});