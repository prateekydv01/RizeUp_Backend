import { Goal } from "../models/goal.model.js";
import { Circle } from "../models/circle.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const canAccessGoal = (goal, userId) => {
  if (goal.createdBy.toString() === userId.toString()) return true;

  if (goal.circleId) {
    const isMember = goal.circleId.members?.some(
      m => m.toString() === userId.toString()
    );

    const isAdmin =
      goal.circleId.admin?.toString() === userId.toString();

    return isMember || isAdmin;
  }

  return false;
};

// ── CREATE GOAL ─────────────────────────────────────────────
export const createGoal = asyncHandler(async (req, res) => {
  const {
    title,
    startDate,
    endDate,
    resources = [],
    type = "personal",
    circleId,
  } = req.body;

   let members = [req.user._id]

  if (!title) throw new ApiError(400, "Title is required");

  const validTypes = ["personal", "circle"];
  if (!validTypes.includes(type)) {
    throw new ApiError(400, "Invalid goal type");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start) || isNaN(end)) {
    throw new ApiError(400, "Invalid date format");
  }

  if (start > end) {
    throw new ApiError(400, "Start date cannot be after end date");
  }

  if (!Array.isArray(resources)) {
    throw new ApiError(400, "Resources must be an array");
  }

  let circle;

  if (type === "circle") {
    if (!circleId) {
      throw new ApiError(400, "circleId required for circle goals");
    }

    circle = await Circle.findById(circleId);
    if (!circle) throw new ApiError(404, "Circle not found");

    if (!circle.members.some(m => m.toString() === req.user._id.toString())) {
      throw new ApiError(403, "You are not a member of this circle");
    }
    
  }

  const goal = await Goal.create({
    title,
    startDate: start,
    endDate: end,
    resources,
    type,
    circleId: type === "circle" ? circleId : undefined,
    createdBy: req.user._id,
    members
  });

  if (type === "circle") {
    circle.goals.push(goal._id);
    await circle.save();
  }

  return res.status(201).json(
    new ApiResponse(201, goal, "Goal created successfully")
  );
});

// ── GET MY GOALS ────────────────────────────────────────────
export const getMyGoals = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { page = 1, limit = 10 } = req.query;

  const goals = await Goal.find({
    $or: [
      { createdBy: userId },        // creator always sees
      { members: userId }           // only joined goals
    ]
  })
    .populate("circleId", "name code")
    .populate("completedBy.userId", "username email")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  const now = new Date();

  const enrichedGoals = goals.map(goal => {
    const completedBy = goal.completedBy || [];
    const completionRequests = goal.completionRequests || [];
    const members = goal.members || [];

    return {
      ...goal,
      isOwner: goal.createdBy.toString() === userId,
      isCircleGoal: !!goal.circleId,

      // 🔥 IMPORTANT ADD
      isJoined: members.some(m => m.toString() === userId),

      isCompleted: completedBy.some(
        entry => entry.userId.toString() === userId
      ),

      isPending: completionRequests.some(
        req =>
          req.userId.toString() === userId &&
          req.status === "pending"
      ),

      daysLeft: Math.max(
        0,
        Math.ceil((new Date(goal.endDate) - now) / 86400000)
      )
    };
  });

  return res.status(200).json(
    new ApiResponse(200, enrichedGoals, "Goals fetched successfully")
  );
});

// ── GET GOAL BY ID ──────────────────────────────────────────
export const getGoalById = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { goalId } = req.params;

  const goal = await Goal.findById(goalId)
    .populate("circleId", "name code members admin")
    .populate("completedBy.userId", "username email")
    .populate("completionRequests.userId", "username email")
    .lean();

  if (!goal) throw new ApiError(404, "Goal not found");

  if (!canAccessGoal(goal, userId)) {
    throw new ApiError(403, "Not allowed");
  }

  const completedBy = goal.completedBy || [];

  const enrichedGoal = {
    ...goal,
    isOwner: goal.createdBy.toString() === userId,
    isCircleGoal: !!goal.circleId,
    isCompleted: completedBy.some(
      e => e.userId.toString() === userId
    )
  };

  return res.status(200).json(
    new ApiResponse(200, enrichedGoal, "Goal fetched")
  );
});

// ── UPDATE GOAL ─────────────────────────────────────────────
export const updateGoal = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { goalId } = req.params;

  const goal = await Goal.findById(goalId).populate("circleId");

  if (!goal) throw new ApiError(404, "Goal not found");

  // ✅ Only creator or admin can edit
  let canEdit =
    goal.createdBy.toString() === userId;

  if (goal.circleId) {
    const isAdmin =
      goal.circleId.admin.toString() === userId;

    if (isAdmin) canEdit = true;
  }

  if (!canEdit) throw new ApiError(403, "Not allowed");

  const { title, startDate, endDate, resources } = req.body;

  const newStart = startDate ? new Date(startDate) : goal.startDate;
  const newEnd = endDate ? new Date(endDate) : goal.endDate;

  if (newStart > newEnd) {
    throw new ApiError(400, "Invalid dates");
  }

  if (title !== undefined) goal.title = title;

  if (startDate !== undefined) goal.startDate = newStart;

  if (endDate !== undefined) goal.endDate = newEnd;

  if (resources !== undefined) {
    if (!Array.isArray(resources)) {
      throw new ApiError(400, "Resources must be an array");
    }
    goal.resources = resources;
  }

  await goal.save();

  return res.status(200).json(
    new ApiResponse(200, goal, "Goal updated")
  );
});

// ── DELETE GOAL ─────────────────────────────────────────────
export const deleteGoal = asyncHandler(async (req, res) => {
  const { goalId } = req.params;
  const userId = req.user._id.toString();

  const goal = await Goal.findById(goalId);

  if (!goal) throw new ApiError(404, "Goal not found");

  if (goal.createdBy.toString() !== userId) {
    throw new ApiError(403, "Not authorized");
  }

  if (goal.circleId) {
    await Circle.findByIdAndUpdate(goal.circleId, {
      $pull: { goals: goal._id }
    });
  }

  await goal.deleteOne();

  return res.status(200).json(
    new ApiResponse(200, {}, "Goal deleted")
  );
});

// ── MARK COMPLETE ───────────────────────────────────────────
export const markGoalComplete = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { goalId } = req.params;
  const { proof } = req.body;

  const goal = await Goal.findById(goalId);
  if (!goal) throw new ApiError(404, "Goal not found");

  if (!goal.members.some(m => m.toString() === userId.toString())) {
  throw new ApiError(403, "Not a member of this goal");
}

  const alreadyCompleted = goal.completedBy.some(
    e => e.userId.toString() === userId.toString()
  );

  if (alreadyCompleted) {
    throw new ApiError(400, "Already completed");
  }

  // ✅ PERSONAL GOAL
  if (goal.type === "personal") {
    goal.completedBy.push({ userId, completedAt: new Date() });
    goal.status = "completed";
    await goal.save();

    return res.status(200).json(
      new ApiResponse(200, goal, "Goal completed")
    );
  }

  // 🔥 ✅ IMPORTANT FIX: AUTO COMPLETE IF ONLY 1 MEMBER
  if (goal.members.length === 1) {
    goal.completedBy.push({
      userId,
      completedAt: new Date()
    });

    if (userId.toString() === goal.createdBy.toString()) {
      goal.status = "completed";
    }

    await goal.save();

    return res.status(200).json(
      new ApiResponse(200, goal, "Goal auto-completed (no peers)")
    );
  }

  // ✅ REQUIRE PROOF FOR CIRCLE
  if (!proof) {
    throw new ApiError(400, "Proof required");
  }

  const existing = goal.completionRequests.find(
    r => r.userId.toString() === userId.toString()
  );

  if (existing) {
    throw new ApiError(400, "Already submitted");
  }

  // ✅ CREATE REQUEST
  goal.completionRequests.push({
    userId,
    proof,
    status: "pending",
    approvals: [],
    rejections: [],
    totalMembersAtRequest: goal.members.length // ⭐ snapshot
  });

  await goal.save();

  return res.status(200).json(
    new ApiResponse(200, goal, "Proof submitted")
  );
});

// ── VERIFY PROOF ────────────────────────────────────────────
export const verifyProof = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { goalId, requestId } = req.params;
  const { action } = req.body;

  const goal = await Goal.findById(goalId);
  if (!goal) throw new ApiError(404, "Goal not found");

   if (!goal.members.some(m => m.toString() === userId.toString())) {
    throw new ApiError(403, "Not a member of this goal");
  }

  const request = goal.completionRequests.id(requestId);
  if (!request) throw new ApiError(404, "Request not found");

  if (request.userId.toString() === userId.toString()) {
    throw new ApiError(400, "Cannot verify your own proof");
  }

  const alreadyVoted =
    request.approvals.some(a => a.userId.toString() === userId.toString()) ||
    request.rejections.some(r => r.userId.toString() === userId.toString());

  if (alreadyVoted) {
    throw new ApiError(400, "Already voted");
  }

  if (action === "approve") {
    request.approvals.push({ userId });
  } else if (action === "reject") {
    request.rejections.push({ userId });
  } else {
    throw new ApiError(400, "Invalid action");
  }

  // ⭐ USE SNAPSHOT (VERY IMPORTANT)
  const totalMembers = request.totalMembersAtRequest - 1;

  if (request.approvals.length >= Math.ceil(totalMembers / 2)) {
    request.status = "approved";
    request.completedAt = new Date();

    goal.completedBy.push({
      userId: request.userId,
      completedAt: request.completedAt
    });

    if (request.userId.toString() === goal.createdBy.toString()) {
      goal.status = "completed";
    }
  }

  // (optional rejection logic)
  if (request.rejections.length >= Math.ceil(totalMembers / 2)) {
    request.status = "rejected";
  }

  await goal.save();

  return res.status(200).json(
    new ApiResponse(200, goal, "Verification updated")
  );
});

export const joinGoal = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { goalId } = req.params;

  const goal = await Goal.findById(goalId).populate("circleId");
  if (!goal) throw new ApiError(404, "Goal not found");

  if (goal.type !== "circle") {
    throw new ApiError(400, "Cannot join personal goal");
  }

  // check circle membership
  const isCircleMember = goal.circleId.members.some(
    m => m.toString() === userId.toString()
  );

  if (!isCircleMember) {
    throw new ApiError(403, "Not part of this circle");
  }

  // prevent duplicate join
  if (goal.members.some(m => m.toString() === userId.toString())) {
    throw new ApiError(400, "Already joined");
  }

  goal.members.push(userId);
  await goal.save();

  return res.status(200).json(
    new ApiResponse(200, goal, "Joined goal successfully")
  );
});

export const leaveGoal = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { goalId } = req.params;

  const goal = await Goal.findById(goalId);
  if (!goal) throw new ApiError(404, "Goal not found");

  if (goal.createdBy.toString() === userId.toString()) {
    throw new ApiError(400, "Creator cannot leave goal");
  }

  const isMember = goal.members.some(
    m => m.toString() === userId.toString()
  );

  if (!isMember) {
    throw new ApiError(400, "Not a member");
  }

  goal.members = goal.members.filter(
    m => m.toString() !== userId.toString()
  );

  await goal.save();

  return res.status(200).json(
    new ApiResponse(200, null, "Left goal successfully")
  );
});

export const getCircleGoals = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { circleId } = req.params;

  const circle = await Circle.findById(circleId);
  if (!circle) throw new ApiError(404, "Circle not found");

  const isMember = circle.members.some(
    m => m.toString() === userId
  );

  if (!isMember) {
    throw new ApiError(403, "Not part of this circle");
  }

  const goals = await Goal.find({ circleId })
    .populate("createdBy", "username")
    .populate("members", "username")
    .populate("completedBy.userId", "username")
    .sort({ createdAt: -1 })
    .lean();

  const enriched = goals.map(goal => ({
    ...goal,
    isJoined: (goal.members || []).some(
      m => m.toString() === userId
    )
  }));

  return res.status(200).json(
    new ApiResponse(200, enriched, "Circle goals fetched")
  );
});

export const getGoalLeaderboard = asyncHandler(async (req, res) => {
  const { goalId } = req.params;

  const goal = await Goal.findById(goalId)
    .populate("completedBy.userId", "username fullName email"); // ✅ added fullName

  if (!goal) throw new ApiError(404, "Goal not found");

  // sort by completion time
  const sorted = goal.completedBy.sort(
    (a, b) => new Date(a.completedAt) - new Date(b.completedAt)
  );

  const leaderboard = sorted.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId._id,
    fullName: entry.userId.fullName,   // ✅ added
    username: entry.userId.username,   // optional but useful
    email: entry.userId.email,         // optional
    completedAt: entry.completedAt
  }));

  return res.status(200).json(
    new ApiResponse(200, leaderboard, "Goal leaderboard fetched")
  );
});