import { Goal } from "../models/goal.model.js";
import { Circle } from "../models/circle.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";


// ── CREATE GOAL ─────────────────────────────────────────────
export const createGoal = asyncHandler(async (req, res) => {
  const {
    title,
    startDate,
    endDate,
    resources = [],
    type = "personal",
    circleId
  } = req.body;

  if (!title) throw new ApiError(400, "Title is required");
  if (!startDate) throw new ApiError(400, "Start date is required");
  if (!endDate) throw new ApiError(400, "End date is required");

  if (new Date(startDate) > new Date(endDate)) {
    throw new ApiError(400, "Start date cannot be after end date");
  }

  if (type === "circle" && !circleId) {
    throw new ApiError(400, "circleId required for circle goals");
  }

  let circle;
  if (type === "circle") {
    circle = await Circle.findById(circleId);
    if (!circle) throw new ApiError(404, "Circle not found");
  }

  const goal = await Goal.create({
    title,
    startDate,
    endDate,
    resources,
    type,
    circleId: type === "circle" ? circleId : undefined,
    createdBy: req.user._id,
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
  const userId = req.user._id;

  const circles = await Circle.find({
    $or: [{ members: userId }, { admin: userId }]
  }).select("_id").lean();

  const circleIds = circles.map(c => c._id);

  // Auto-move overdue active goals to backlog
  await Goal.updateMany(
    {
      $or: [{ createdBy: userId }, { circleId: { $in: circleIds } }],
      status: "active",
      endDate: { $lt: new Date() }
    },
    { $set: { status: "backlog" } }
  );

  const goals = await Goal.find({
    $or: [
      { createdBy: userId },
      { circleId: { $in: circleIds } }
    ]
  })
    .populate("circleId", "name code")
    .sort({ createdAt: -1 })
    .lean();

  const enrichedGoals = goals.map(goal => ({
    ...goal,
    isOwner: goal.createdBy.toString() === userId.toString(),
    isCircleGoal: !!goal.circleId,
    isCompleted: goal.completedBy.some(
      entry => entry.userId.toString() === userId.toString()
    ),
    isPending: goal.completionRequests.some(
      req =>
        req.userId.toString() === userId.toString() &&
        req.status === "pending"
    ),
    daysLeft: Math.ceil((new Date(goal.endDate) - new Date()) / 86400000)
  }));

  return res.status(200).json(
    new ApiResponse(200, enrichedGoals, "Goals fetched successfully")
  );
});


// ── GET GOAL BY ID ──────────────────────────────────────────
export const getGoalById = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { goalId } = req.params;

  const goal = await Goal.findById(goalId)
    .populate("circleId", "name code members admin")
    .lean();

  if (!goal) throw new ApiError(404, "Goal not found");

  let hasAccess = false;

  if (goal.createdBy.toString() === userId.toString()) hasAccess = true;

  if (goal.circleId) {
    const isMember = goal.circleId.members.some(
      m => m.toString() === userId.toString()
    );
    const isAdmin =
      goal.circleId.admin.toString() === userId.toString();

    if (isMember || isAdmin) hasAccess = true;
  }

  if (!hasAccess) {
    throw new ApiError(403, "Not allowed");
  }

  const enrichedGoal = {
    ...goal,
    isOwner: goal.createdBy.toString() === userId.toString(),
    isCircleGoal: !!goal.circleId,
    isCompleted: goal.completedBy.some(
      e => e.userId.toString() === userId.toString()
    )
  };

  return res.status(200).json(
    new ApiResponse(200, enrichedGoal, "Goal fetched")
  );
});


// ── UPDATE GOAL ─────────────────────────────────────────────
export const updateGoal = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { goalId } = req.params;

  const goal = await Goal.findById(goalId).populate("circleId");

  if (!goal) throw new ApiError(404, "Goal not found");

  let hasAccess =
    goal.createdBy.toString() === userId.toString();

  if (goal.circleId) {
    const isMember = goal.circleId.members.some(
      m => m.toString() === userId.toString()
    );
    const isAdmin =
      goal.circleId.admin.toString() === userId.toString();

    if (isMember || isAdmin) hasAccess = true;
  }

  if (!hasAccess) throw new ApiError(403, "Not allowed");

  const { title, startDate, endDate, resources } = req.body;

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw new ApiError(400, "Invalid dates");
  }

  if (title !== undefined) goal.title = title;
  if (startDate !== undefined) goal.startDate = startDate;
  if (endDate !== undefined) goal.endDate = endDate;
  if (resources !== undefined) goal.resources = resources;

  await goal.save();

  return res.status(200).json(
    new ApiResponse(200, goal, "Goal updated")
  );
});


// ── DELETE GOAL ─────────────────────────────────────────────
export const deleteGoal = asyncHandler(async (req, res) => {
  const { goalId } = req.params;

  const goal = await Goal.findById(goalId);

  if (!goal) throw new ApiError(404, "Goal not found");

  if (goal.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not authorized");
  }

  if (goal.circleId) {
    await Circle.findByIdAndUpdate(goal.circleId, {
      $pull: { goals: goal._id }
    });
  }

  await Goal.findByIdAndDelete(goalId);

  return res.status(200).json(
    new ApiResponse(200, {}, "Goal deleted")
  );
});


// ── MARK COMPLETE ───────────────────────────────────────────
export const markGoalComplete = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { goalId } = req.params;
  const { proof } = req.body;

  const goal = await Goal.findById(goalId).populate("circleId");
  if (!goal) throw new ApiError(404, "Goal not found");

  const alreadyCompleted = goal.completedBy.some(
    e => e.userId.toString() === userId.toString()
  );

  if (alreadyCompleted) {
    throw new ApiError(400, "Already completed");
  }

  if (goal.type === "personal") {
    goal.completedBy.push({ userId, completedAt: new Date() });
    goal.status = "completed";
    await goal.save();

    return res.status(200).json(
      new ApiResponse(200, goal, "Goal completed")
    );
  }

  if (!proof) {
    throw new ApiError(400, "Proof required");
  }

  const existing = goal.completionRequests.find(
    r => r.userId.toString() === userId.toString()
  );

  if (existing) {
    throw new ApiError(400, "Already submitted");
  }

  goal.completionRequests.push({
    userId,
    proof,
    status: "pending"
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
  const { action } = req.body; // approve / reject

  const goal = await Goal.findById(goalId).populate("circleId");
  if (!goal) throw new ApiError(404, "Goal not found");

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
  } else {
    request.rejections.push({ userId });
  }

  const totalMembers = goal.circleId.members.length - 1;

  if (request.approvals.length >= Math.ceil(totalMembers / 2)) {
    request.status = "approved";
    request.completedAt = new Date();

    goal.completedBy.push({
      userId: request.userId,
      completedAt: request.completedAt
    });

    // Mark goal completed if the creator is done
    if (request.userId.toString() === goal.createdBy.toString()) {
      goal.status = "completed";
    }
  }

  await goal.save();

  return res.status(200).json(
    new ApiResponse(200, goal, "Verification updated")
  );
});