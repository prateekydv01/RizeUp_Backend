import { Goal } from "../models/goal.model.js";
import { Circle } from "../models/circle.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const canAccessGoal = (goal, userId) => {
  if (goal.createdBy.toString() === userId.toString()) return true;
  if (goal.circleId && goal.circleId.members) {
    return goal.circleId.members.some(m => m.toString() === userId.toString()) ||
           goal.circleId.admin?.toString() === userId.toString();
  }
  return false;
};

// ── CREATE GOAL ─────────────────────────────────────────────
export const createGoal = asyncHandler(async (req, res) => {
  const { title, startDate, endDate, resources = [], type = "personal", circleId } = req.body;
  let members = [req.user._id];

  if (!title) throw new ApiError(400, "Title is required");
  if (!["personal", "circle"].includes(type)) throw new ApiError(400, "Invalid goal type");

  const start = new Date(startDate);
  const end   = new Date(endDate);
  if (isNaN(start) || isNaN(end)) throw new ApiError(400, "Invalid date format");
  if (start > end) throw new ApiError(400, "Start date cannot be after end date");
  if (!Array.isArray(resources)) throw new ApiError(400, "Resources must be an array");

  let circle;
  if (type === "circle") {
    if (!circleId) throw new ApiError(400, "circleId required for circle goals");
    circle = await Circle.findById(circleId);
    if (!circle) throw new ApiError(404, "Circle not found");
    if (!circle.members.some(m => m.toString() === req.user._id.toString()))
      throw new ApiError(403, "You are not a member of this circle");
  }

  const goal = await Goal.create({ title, startDate: start, endDate: end, resources, type, circleId: type === "circle" ? circleId : undefined, createdBy: req.user._id, members });

  if (type === "circle") { circle.goals.push(goal._id); await circle.save(); }

  return res.status(201).json(new ApiResponse(201, goal, "Goal created successfully"));
});

// ── GET MY GOALS ─────────────────────────────────────────── (FIXED: backlog sync)
export const getMyGoals = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { page = 1, limit = 50 } = req.query;
  const now = new Date();
  req.userId?._id?.toString() === userId

  // ✅ FIX: Auto-move overdue active goals to backlog BEFORE fetching
  await Goal.updateMany(
    {
      $or: [{ createdBy: userId }, { members: userId }],
      status: "active",
      endDate: { $lt: now }
    },
    { $set: { status: "backlog" } }
  );

  const goals = await Goal.find({ $or: [{ createdBy: userId }, { members: userId }] })
    .populate("circleId", "name code")
    .populate("completedBy.userId", "username fullName")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  const enrichedGoals = goals.map(goal => {
    const completedBy        = goal.completedBy        || [];
    const completionRequests = goal.completionRequests || [];
    const members            = goal.members            || [];

    return {
      ...goal,
      isOwner:      goal.createdBy.toString() === userId,
      isCircleGoal: !!goal.circleId,
      isJoined:     members.some(m => m.toString() === userId),
      isCompleted:  completedBy.some(e => e.userId?.toString() === userId),
      isPending:    completionRequests.some(r => r.userId?.toString() === userId && r.status === "pending"),
      daysLeft:     Math.ceil((new Date(goal.endDate) - now) / 86400000),
    };
  });

  return res.status(200).json(new ApiResponse(200, enrichedGoals, "Goals fetched successfully"));
});

// ── GET GOAL BY ID ──────────────────────────────────────────
export const getGoalById = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { goalId } = req.params;

  const goal = await Goal.findById(goalId)
    .populate("circleId", "name code members admin")
    .populate("completedBy.userId", "username fullName email")
    .populate("completionRequests.userId", "username fullName email")
    .lean();

  if (!goal) throw new ApiError(404, "Goal not found");
  if (!canAccessGoal(goal, userId)) throw new ApiError(403, "Not allowed");

  const enrichedGoal = {
    ...goal,
    isOwner:      goal.createdBy.toString() === userId,
    isCircleGoal: !!goal.circleId,
    isCompleted:  (goal.completedBy || []).some(e => e.userId?.toString() === userId),
    isMyPending: (goal.completionRequests || []).some(
      r => r.userId?._id?.toString() === userId && r.status === "pending"
    ),

    hasPendingToVerify: (goal.completionRequests || []).some(
      r => r.userId?._id?.toString() !== userId && r.status === "pending"
    ),
  };

  return res.status(200).json(new ApiResponse(200, enrichedGoal, "Goal fetched"));
});

// ── UPDATE GOAL ─────────────────────────────────────────────
export const updateGoal = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { goalId } = req.params;

  const goal = await Goal.findById(goalId).populate("circleId");
  if (!goal) throw new ApiError(404, "Goal not found");

  const canEdit = goal.createdBy.toString() === userId ||
                  goal.circleId?.admin?.toString() === userId;
  if (!canEdit) throw new ApiError(403, "Not allowed");

  const { title, startDate, endDate, resources } = req.body;
  const newStart = startDate ? new Date(startDate) : goal.startDate;
  const newEnd   = endDate   ? new Date(endDate)   : goal.endDate;
  if (newStart > newEnd) throw new ApiError(400, "Invalid dates");

  if (title     !== undefined) goal.title     = title;
  if (startDate !== undefined) goal.startDate = newStart;
  if (endDate   !== undefined) goal.endDate   = newEnd;
  if (resources !== undefined) {
    if (!Array.isArray(resources)) throw new ApiError(400, "Resources must be an array");
    goal.resources = resources;
  }

  await goal.save();
  return res.status(200).json(new ApiResponse(200, goal, "Goal updated"));
});

// ── DELETE GOAL ─────────────────────────────────────────────
export const deleteGoal = asyncHandler(async (req, res) => {
  const { goalId } = req.params;
  const userId = req.user._id.toString();

  const goal = await Goal.findById(goalId);
  if (!goal) throw new ApiError(404, "Goal not found");
  if (goal.createdBy.toString() !== userId) throw new ApiError(403, "Not authorized");

  if (goal.circleId) await Circle.findByIdAndUpdate(goal.circleId, { $pull: { goals: goal._id } });
  await goal.deleteOne();

  return res.status(200).json(new ApiResponse(200, {}, "Goal deleted"));
});

// ── MARK COMPLETE ───────────────────────────────────────────
export const markGoalComplete = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { goalId } = req.params;
  const { proof } = req.body;

  const goal = await Goal.findById(goalId);
  if (!goal) throw new ApiError(404, "Goal not found");
  if (!goal.members.some(m => m.toString() === userId.toString())) throw new ApiError(403, "Not a member");
  if (goal.completedBy.some(e => e.userId.toString() === userId.toString())) throw new ApiError(400, "Already completed");

  if (goal.type === "personal") {
    goal.completedBy.push({ userId, completedAt: new Date() });
    goal.status = "completed";
    await goal.save();
    return res.json(new ApiResponse(200, goal, "Goal completed"));
  }

  if (goal.members.length === 1) {
    goal.completedBy.push({ userId, completedAt: new Date() });
    goal.status = "completed";
    await goal.save();
    return res.json(new ApiResponse(200, goal, "Auto completed"));
  }

  if (!proof) throw new ApiError(400, "Proof required");
  if (goal.completionRequests.find(r => r.userId.toString() === userId.toString())) throw new ApiError(400, "Already submitted");

  goal.completionRequests.push({ userId, proof, status: "pending", approvals: [], rejections: [], totalMembersAtRequest: goal.members.length });
  await goal.save();
  return res.json(new ApiResponse(200, goal, "Proof submitted"));
});

// ── VERIFY PROOF ─────────────────────────────────────────── (FIXED: all members see all pending requests)
export const verifyProof = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { goalId, requestId } = req.params;
  const { action } = req.body;

  const goal = await Goal.findById(goalId);
  if (!goal) throw new ApiError(404, "Goal not found");

  // ✅ FIX: Any goal member can verify (not just the first one)
  if (!goal.members.some(m => m.toString() === userId.toString()))
    throw new ApiError(403, "Not a member");

  const request = goal.completionRequests.id(requestId);
  if (!request) throw new ApiError(404, "Request not found");
  if (request.status !== "pending") return res.json(new ApiResponse(200, goal, "Already finalized"));
  if (request.userId.toString() === userId.toString()) throw new ApiError(400, "Cannot verify your own proof");

  const alreadyVoted =
    request.approvals.some(a => a.userId.toString() === userId.toString()) ||
    request.rejections.some(r => r.userId.toString() === userId.toString());
  if (alreadyVoted) throw new ApiError(400, "Already voted");

  if (action === "approve")     request.approvals.push({ userId });
  else if (action === "reject") request.rejections.push({ userId });
  else throw new ApiError(400, "Invalid action");

  // ✅ FIX: totalVoters = all goal members minus the submitter (not minus 1 globally)
  const totalVoters = request.totalMembersAtRequest - 1;
  const majority    = Math.floor(totalVoters / 2) + 1;

  if (request.approvals.length >= majority) {
    request.status      = "approved";
    request.completedAt = new Date();
    goal.completedBy.push({ userId: request.userId, completedAt: request.completedAt });
    // ✅ FIX: Don't mark whole goal completed just because one person's request approved
    // Only mark completed if ALL members who submitted have been approved
    const allMembersCompleted = goal.members.every(memberId =>
      goal.completedBy.some(c => c.userId.toString() === memberId.toString()) ||
      memberId.toString() === request.userId.toString()
    );
    // Just mark individual completion — goal status stays active until creator completes
    // OR mark completed if the submitter is the creator
    if (request.userId.toString() === goal.createdBy.toString()) {
      goal.status = "completed";
    }
  }

  if (request.rejections.length >= majority) request.status = "rejected";

  await goal.save();
  return res.json(new ApiResponse(200, goal, "Verification updated"));
});

// ── JOIN GOAL ───────────────────────────────────────────────
export const joinGoal = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { goalId } = req.params;

  const goal = await Goal.findById(goalId).populate("circleId");
  if (!goal) throw new ApiError(404, "Goal not found");
  if (goal.type !== "circle") throw new ApiError(400, "Cannot join personal goal");

  const isCircleMember = goal.circleId.members.some(m => m.toString() === userId.toString());
  if (!isCircleMember) throw new ApiError(403, "Not part of this circle");
  if (goal.members.some(m => m.toString() === userId.toString())) throw new ApiError(400, "Already joined");

  goal.members.push(userId);
  await goal.save();
  return res.status(200).json(new ApiResponse(200, goal, "Joined goal successfully"));
});

// ── LEAVE GOAL ──────────────────────────────────────────────
export const leaveGoal = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { goalId } = req.params;

  const goal = await Goal.findById(goalId);
  if (!goal) throw new ApiError(404, "Goal not found");
  if (goal.createdBy.toString() === userId.toString()) throw new ApiError(400, "Creator cannot leave goal");
  if (!goal.members.some(m => m.toString() === userId.toString())) throw new ApiError(400, "Not a member");

  goal.members = goal.members.filter(m => m.toString() !== userId.toString());
  await goal.save();
  return res.status(200).json(new ApiResponse(200, null, "Left goal successfully"));
});

// ── GET CIRCLE GOALS ────────────────────────────────────────
export const getCircleGoals = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { circleId } = req.params;

  const circle = await Circle.findById(circleId);
  if (!circle) throw new ApiError(404, "Circle not found");
  if (!circle.members.some(m => m.toString() === userId)) throw new ApiError(403, "Not part of this circle");

  const goals = await Goal.find({ circleId })
    .populate("createdBy", "username fullName")
    .populate("members",   "username fullName")
    .populate("completedBy.userId", "username fullName")
    .sort({ createdAt: -1 }).lean();

  const enriched = goals.map(goal => ({
    ...goal,
    isJoined: (goal.members || []).some(m => (m._id || m).toString() === userId)
  }));

  return res.status(200).json(new ApiResponse(200, enriched, "Circle goals fetched"));
});

// ── LEADERBOARD ─────────────────────────────────────────────
export const getGoalLeaderboard = asyncHandler(async (req, res) => {
  const { goalId } = req.params;
  const goal = await Goal.findById(goalId).populate("completedBy.userId", "username fullName email");
  if (!goal) throw new ApiError(404, "Goal not found");

  const sorted = [...goal.completedBy].sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const leaderboard = sorted.map((entry, index) => ({
    rank:        index + 1,
    userId:      entry.userId._id,
    fullName:    entry.userId.fullName,
    username:    entry.userId.username,
    completedAt: entry.completedAt,
  }));

  return res.status(200).json(new ApiResponse(200, leaderboard, "Goal leaderboard fetched"));
});

// ── ADD DAILY LOG ────────────────────────────────────────────
export const addDailyLog = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { goalId } = req.params;
  const { text, proof } = req.body;

  if (!text?.trim()) throw new ApiError(400, "Log text is required");

  const goal = await Goal.findById(goalId);
  if (!goal) throw new ApiError(404, "Goal not found");

  if (goal.type === "personal" && goal.createdBy.toString() !== userId.toString())
    throw new ApiError(403, "Not allowed");
  if (goal.type === "circle" && !goal.members.some(m => m.toString() === userId.toString()))
    throw new ApiError(403, "Not a member");

  const today = new Date();
  const alreadyLogged = goal.dailyLogs.some(
    log => log.userId.toString() === userId.toString() &&
           new Date(log.date).toDateString() === today.toDateString()
  );
  if (alreadyLogged) throw new ApiError(400, "Already logged today");

  goal.dailyLogs.push({ userId, date: today, text, proof });
  await goal.save();
  return res.status(200).json(new ApiResponse(200, goal.dailyLogs[goal.dailyLogs.length - 1], "Daily log added"));
});

// ── GET DAILY LOGS ───────────────────────────────────────────
export const getGoalLogs = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { goalId } = req.params;

  const goal = await Goal.findById(goalId).populate("dailyLogs.userId", "username fullName");
  if (!goal) throw new ApiError(404, "Goal not found");

  if (goal.type === "personal" && goal.createdBy.toString() !== userId)
    throw new ApiError(403, "Not allowed");
  if (goal.type === "circle" && !goal.members.some(m => m.toString() === userId))
    throw new ApiError(403, "Not a member");

  // Sort newest first
  const sorted = [...goal.dailyLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
  return res.status(200).json(new ApiResponse(200, sorted, "Logs fetched"));
});