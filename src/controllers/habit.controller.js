import { Habit } from "../models/habit.model.js";
import { CheckIn } from "../models/checkIn.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Circle } from "../models/circle.model.js";

const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

// ── CREATE HABIT ──────────────────────────────────────────────────────────────
// POST /habits/create
export const createHabit = asyncHandler(async (req, res) => {
  const { title, description, type = "personal", circleId } = req.body;

  if (!title) throw new ApiError(400, "Title is required");

  const validTypes = ["personal", "circle"];
  if (!validTypes.includes(type)) {
    throw new ApiError(400, "Invalid habit type");
  }

  let members = [req.user._id];

  let circle;

  if (type === "circle") {
    if (!circleId) {
      throw new ApiError(400, "circleId is required for circle habits");
    }

    circle = await Circle.findById(circleId);
    if (!circle) throw new ApiError(404, "Circle not found");

    if (!circle.members.includes(req.user._id)) {
      throw new ApiError(403, "You are not a member of this circle");
    }

  }

  const habit = await Habit.create({
    title,
    description,
    type,
    circleId: type === "circle" ? circleId : undefined,
    createdBy: req.user._id,
    members,
  });

  if (type === "circle") {
    circle.goals.push(habit._id);
    await circle.save();
  }

  return res.status(201).json(
    new ApiResponse(201, habit, "Habit created successfully")
  );
});

// ── GET MY HABITS (personal+circle)─────────────────────────────────────────────────────────────
export const getMyHabits = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, type } = req.query;

  const filter = {
    members: req.user._id,
    isActive: true,
  };

  if (type) filter.type = type;

  const habits = await Habit.find(filter)
    .populate("circleId", "name code")
    .populate("createdBy", "username fullName")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  return res.status(200).json(
    new ApiResponse(200, habits, "Habits fetched successfully")
  );
});

// ── GET SINGLE HABIT ──────────────────────────────────────────────────────────
export const getHabitById = asyncHandler(async (req, res) => {
  const { habitId } = req.params;

  if (habit.type === "personal") {
  if (habit.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized access");
  }
}

if (habit.type === "circle") {
  const isMember = habit.members.some(
    (id) => id.toString() === req.user._id.toString()
  );

  if (!isMember) {
    throw new ApiError(403, "You are not a member of this habit");
  }
}

  const habit = await Habit.findById(habitId)
    .populate("createdBy", "username fullName")
    .populate("members", "username fullName")
    .populate("circleId", "name code");

  if (!habit) throw new ApiError(404, "Habit not found");

  return res.status(200).json(
    new ApiResponse(200, habit, "Habit fetched successfully")
  );
});

// ── UPDATE HABIT (only who created)──────────────────────────────────────────────────────────────
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

  if (!habit.circleId) {
    throw new ApiError(400, "Habit is not linked to a circle");
  }

  const circle = await Circle.findById(habit.circleId);
  if (!circle) throw new ApiError(404, "Circle not found");

  const isCircleMember = circle.members.some(
    (id) => id.toString() === req.user._id.toString()
  );

  if (!isCircleMember) {
    throw new ApiError(403, "You are not a member of this circle");
  }

  const updatedHabit = await Habit.findByIdAndUpdate(
    habitId,
    { $addToSet: { members: req.user._id } }, // prevents duplicates
    { new: true }
  );

  return res.status(200).json(
    new ApiResponse(200, updatedHabit, "Joined habit successfully")
  );
});

// ── LEAVE HABIT ───────────────────────────────────────────────────────────────
export const leaveHabit = asyncHandler(async (req, res) => {
  const { habitId } = req.params;

  const habit = await Habit.findById(habitId);
  if (!habit) throw new ApiError(404, "Habit not found");

  // Creator cannot leave
  if (habit.createdBy.toString() === req.user._id.toString()) {
    throw new ApiError(400, "Creator cannot leave — delete the habit instead");
  }

  // Check if user is actually a member
  const isMember = habit.members.some(
    (m) => m.toString() === req.user._id.toString()
  );

  if (!isMember) {
    throw new ApiError(400, "You are not a member of this habit");
  }

  // Remove user
  habit.members = habit.members.filter(
    (m) => m.toString() !== req.user._id.toString()
  );

  await habit.save();

  return res.status(200).json(
    new ApiResponse(200, null, "Left habit successfully")
  );
});

// ── GET HABITS BY CIRCLE (cirlcle habits for joining)──────────────────────────────────────────────────────
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
    throw new ApiError(403, "Only the creator can link this habit");
  }

  if (habit.type === "circle") {
    throw new ApiError(400, "Habit is already linked to a circle");
  }

  const circle = await Circle.findById(circleId);
  if (!circle) throw new ApiError(404, "Circle not found");

  if (!circle.members.some(m => m.toString() === userId.toString())) {
    throw new ApiError(403, "You are not a member of this circle");
  }

  // Link habit to circle (do NOT auto-add members)
  habit.type = "circle";
  habit.circleId = circleId;
  await habit.save();

  // Add habit to circle if not already present
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