import { Habit } from "../models/habit.model.js";
import { CheckIn } from "../models/checkIn.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

// ── CREATE HABIT ──────────────────────────────────────────────────────────────
// POST /habits/create
export const createHabit = asyncHandler(async (req, res) => {
  const { title, description, type, circleId } = req.body;

  if (!title) throw new ApiError(400, "Title is required");

  if (type === "circle" && !circleId) {
    throw new ApiError(400, "circleId is required for circle habits");
  }

  const habit = await Habit.create({
    title,
    description,
    type: type || "personal",
    circleId: type === "circle" ? circleId : undefined,
    createdBy: req.user._id,
    members: [req.user._id],  // creator auto-joins
  });

  return res.status(201).json(
    new ApiResponse(201, habit, "Habit created successfully")
  );
});

// ── GET MY HABITS ─────────────────────────────────────────────────────────────
// GET /habits/my-habits
// Returns personal habits + circle habits the user has joined
export const getMyHabits = asyncHandler(async (req, res) => {
  const habits = await Habit.find({
    members: req.user._id,
    isActive: true,
  }).populate("circleId", "name code");

  return res.status(200).json(
    new ApiResponse(200, habits, "Habits fetched successfully")
  );
});

// ── GET SINGLE HABIT ──────────────────────────────────────────────────────────
// GET /habits/:habitId
export const getHabitById = asyncHandler(async (req, res) => {
  const { habitId } = req.params;

  const habit = await Habit.findById(habitId)
    .populate("createdBy", "username fullName")
    .populate("members", "username fullName")
    .populate("circleId", "name code");

  if (!habit) throw new ApiError(404, "Habit not found");

  return res.status(200).json(
    new ApiResponse(200, habit, "Habit fetched successfully")
  );
});

// ── UPDATE HABIT ──────────────────────────────────────────────────────────────
// PATCH /habits/update/:habitId
export const updateHabit = asyncHandler(async (req, res) => {
  const { habitId } = req.params;
  const { title, description } = req.body;

  const habit = await Habit.findById(habitId);
  if (!habit) throw new ApiError(404, "Habit not found");

  if (habit.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the creator can update this habit");
  }

  const updated = await Habit.findByIdAndUpdate(
    habitId,
    { title, description },
    { new: true }
  );

  return res.status(200).json(
    new ApiResponse(200, updated, "Habit updated successfully")
  );
});

// ── DELETE HABIT ──────────────────────────────────────────────────────────────
// DELETE /habits/delete/:habitId
export const deleteHabit = asyncHandler(async (req, res) => {
  const { habitId } = req.params;

  const habit = await Habit.findById(habitId);
  if (!habit) throw new ApiError(404, "Habit not found");

  if (habit.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the creator can delete this habit");
  }

  await Habit.findByIdAndDelete(habitId);

  return res.status(200).json(
    new ApiResponse(200, {}, "Habit deleted successfully")
  );
});

// ── JOIN HABIT ────────────────────────────────────────────────────────────────
// POST /habits/join/:habitId
// Only for circle habits — any circle member can join
export const joinHabit = asyncHandler(async (req, res) => {
  const { habitId } = req.params;

  const habit = await Habit.findById(habitId);
  if (!habit) throw new ApiError(404, "Habit not found");

  if (habit.type !== "circle") {
    throw new ApiError(400, "You can only join circle habits");
  }

  if (habit.members.includes(req.user._id)) {
    throw new ApiError(400, "Already a member of this habit");
  }

  habit.members.push(req.user._id);
  await habit.save();

  return res.status(200).json(
    new ApiResponse(200, habit, "Joined habit successfully")
  );
});

// ── LEAVE HABIT ───────────────────────────────────────────────────────────────
// PATCH /habits/leave/:habitId
export const leaveHabit = asyncHandler(async (req, res) => {
  const { habitId } = req.params;

  const habit = await Habit.findById(habitId);
  if (!habit) throw new ApiError(404, "Habit not found");

  if (habit.createdBy.toString() === req.user._id.toString()) {
    throw new ApiError(400, "Creator cannot leave — delete the habit instead");
  }

  habit.members = habit.members.filter(
    (m) => m.toString() !== req.user._id.toString()
  );
  await habit.save();

  return res.status(200).json(
    new ApiResponse(200, null, "Left habit successfully")
  );
});

// ── GET HABITS BY CIRCLE ──────────────────────────────────────────────────────
// GET /habits/circle/:circleId
// Returns all habits for a circle — so members can discover and join
export const getCircleHabits = asyncHandler(async (req, res) => {
  const { circleId } = req.params;

  const habits = await Habit.find({
    circleId,
    type: "circle",
    isActive: true,
  }).populate("createdBy", "username fullName")
    .populate("members", "username fullName");

  return res.status(200).json(
    new ApiResponse(200, habits, "Circle habits fetched successfully")
  );
});

// ── CHECK IN ──────────────────────────────────────────────────────────────────
// POST /habits/checkin/:habitId
// Toggles today's check-in + updates streak on the habit
export const checkInHabit = asyncHandler(async (req, res) => {
  const { habitId } = req.params;
  const userId = req.user._id;
  const today = todayStr();

  const habit = await Habit.findById(habitId);
  if (!habit) throw new ApiError(404, "Habit not found");

  if (!habit.members.includes(userId)) {
    throw new ApiError(403, "You are not a member of this habit");
  }

  const existing = await CheckIn.findOne({
    userId,
    entityType: "habit",
    entityId: habitId,
    date: today,
  });

  // Toggle off
  if (existing) {
    await existing.deleteOne();

    // Recalculate streak — just decrement if it was today
    if (habit.lastCheckInDate === today) {
      habit.streak = Math.max(0, (habit.streak || 1) - 1);
      habit.lastCheckInDate = yesterdayStr();
      await habit.save({ validateBeforeSave: false });
    }

    return res.status(200).json(
      new ApiResponse(200, { checkedIn: false, streak: habit.streak }, "Check-in removed")
    );
  }

  // Toggle on — update streak
  let newStreak;
  if (habit.lastCheckInDate === yesterdayStr()) {
    newStreak = (habit.streak || 0) + 1;
  } else if (habit.lastCheckInDate === today) {
    newStreak = habit.streak;
  } else {
    newStreak = 1;  // streak broken, reset
  }

  habit.streak = newStreak;
  habit.lastCheckInDate = today;
  await habit.save({ validateBeforeSave: false });

  await CheckIn.create({
    userId,
    entityType: "habit",
    entityId: habitId,
    date: today,
    completed: true,
  });

  return res.status(201).json(
    new ApiResponse(201, { checkedIn: true, streak: newStreak }, "Habit checked in")
  );
});

// ── GET MY CONTRIBUTION GRAPH ─────────────────────────────────────────────────
// GET /habits/graph/:habitId?year=2025
// Returns my check-in dates for the full year (Jan 1 – Dec 31)
export const getMyHabitGraph = asyncHandler(async (req, res) => {
  const { habitId } = req.params;
  const userId = req.user._id;
  const year = Number(req.query.year) || new Date().getFullYear();

  const startStr = `${year}-01-01`;
  const endStr   = `${year}-12-31`;

  const checkIns = await CheckIn.find({
    userId,
    entityType: "habit",
    entityId: habitId,
    date: { $gte: startStr, $lte: endStr },
    completed: true,
  }).select("date");

  return res.status(200).json(
    new ApiResponse(200, {
      year,
      dates: checkIns.map((c) => c.date),  // ["2025-01-03", "2025-01-04", ...]
    }, "Graph data fetched")
  );
});

// ── GET MEMBER GRAPHS (circle habits only) ────────────────────────────────────
// GET /habits/members-graph/:habitId?year=2025
// Returns full year check-in graph for ALL members
export const getMembersGraph = asyncHandler(async (req, res) => {
  const { habitId } = req.params;
  const year = Number(req.query.year) || new Date().getFullYear();

  const habit = await Habit.findById(habitId).populate("members", "username fullName");
  if (!habit) throw new ApiError(404, "Habit not found");

  if (habit.type !== "circle") {
    throw new ApiError(400, "Member graphs are only available for circle habits");
  }

  if (!habit.members.some((m) => m._id.toString() === req.user._id.toString())) {
    throw new ApiError(403, "You are not a member of this habit");
  }

  const startStr = `${year}-01-01`;
  const endStr   = `${year}-12-31`;

  // Fetch all check-ins for this habit in the year
  const allCheckIns = await CheckIn.find({
    entityType: "habit",
    entityId: habitId,
    date: { $gte: startStr, $lte: endStr },
    completed: true,
  }).select("userId date");

  // Group by userId
  const graphMap = {};
  habit.members.forEach((member) => {
    graphMap[member._id.toString()] = {
      user: { _id: member._id, username: member.username, fullName: member.fullName },
      year,
      dates: [],
    };
  });

  allCheckIns.forEach((c) => {
    const key = c.userId.toString();
    if (graphMap[key]) graphMap[key].dates.push(c.date);
  });

  return res.status(200).json(
    new ApiResponse(200, Object.values(graphMap), "Members graph fetched")
  );
});

// ── LINK PERSONAL HABIT TO CIRCLE ────────────────────────────────────────────
// PATCH /habits/link-circle/:habitId
// Converts a personal habit to a circle habit and invites all circle members
export const linkHabitToCircle = asyncHandler(async (req, res) => {
  const { habitId } = req.params;
  const { circleId } = req.body;
  const userId = req.user._id;

  const habit = await Habit.findById(habitId);
  if (!habit) throw new ApiError(404, "Habit not found");

  if (habit.createdBy.toString() !== userId.toString()) {
    throw new ApiError(403, "Only the creator can link this habit to a circle");
  }

  if (habit.type === "circle") {
    throw new ApiError(400, "Habit is already linked to a circle");
  }

  // Fetch circle to get its members
  const { Circle } = await import("../models/circle.model.js");
  const circle = await Circle.findById(circleId);
  if (!circle) throw new ApiError(404, "Circle not found");

  // Check creator is a member of the circle
  if (!circle.members.some(m => m.toString() === userId.toString())) {
    throw new ApiError(403, "You are not a member of this circle");
  }

  // Merge existing habit members with circle members (no duplicates)
  const existingIds = habit.members.map(m => m.toString());
  const newMembers  = circle.members.filter(m => !existingIds.includes(m.toString()));

  habit.type     = "circle";
  habit.circleId = circleId;
  habit.members  = [...habit.members, ...newMembers];
  await habit.save();

  // Also push habit into circle's habits array if not already there
  if (!circle.habits.some(h => h.toString() === habitId)) {
    circle.habits.push(habitId);
    await circle.save();
  }

  const populated = await Habit.findById(habitId)
    .populate("circleId", "name code")
    .populate("members", "username fullName");

  return res.status(200).json(
    new ApiResponse(200, populated, "Habit linked to circle successfully")
  );
});

// ── UNLINK HABIT FROM CIRCLE ──────────────────────────────────────────────────
// PATCH /habits/unlink-circle/:habitId
// Converts back to personal habit, keeps check-in history intact
export const unlinkHabitFromCircle = asyncHandler(async (req, res) => {
  const { habitId } = req.params;
  const userId = req.user._id;

  const habit = await Habit.findById(habitId);
  if (!habit) throw new ApiError(404, "Habit not found");

  if (habit.createdBy.toString() !== userId.toString()) {
    throw new ApiError(403, "Only the creator can unlink this habit");
  }

  if (habit.type !== "circle") {
    throw new ApiError(400, "Habit is not linked to a circle");
  }

  // Remove from circle's habits array
  const { Circle } = await import("../models/circle.model.js");
  await Circle.findByIdAndUpdate(habit.circleId, {
    $pull: { habits: habit._id }
  });

  // Keep only the creator as member, revert to personal
  habit.type     = "personal";
  habit.circleId = undefined;
  habit.members  = [userId];
  await habit.save();

  return res.status(200).json(
    new ApiResponse(200, habit, "Habit unlinked from circle successfully")
  );
});