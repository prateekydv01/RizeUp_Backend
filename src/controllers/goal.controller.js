import { Goals } from "../models/goals.model.js";
import { Circle } from "../models/circle.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


/*
CREATE GOAL
POST /goal/create
*/
export const createGoal = asyncHandler(async (req, res) => {

    const { title, description, circleId, deadline } = req.body;

    if (!title) {
        throw new ApiError(400, "Goal title is required");
    }

    const goal = await Goal.create({
        title,
        description,
        circle: circleId,
        createdBy: req.user._id,
        deadline
    });

    if (circleId) {
        await Circle.findByIdAndUpdate(circleId, {
            $push: { goals: goal._id }
        });
    }

    return res.status(201).json(
        new ApiResponse(201, goal, "Goal created successfully")
    );
});


/*
GET USER GOALS
GET /goal/user-goals
*/
export const getUserGoals = asyncHandler(async (req, res) => {

    const goals = await Goal.find({
        createdBy: req.user._id
    }).sort({ createdAt: -1 });

    return res.status(200).json(
        new ApiResponse(200, goals, "User goals fetched successfully")
    );
});


/*
GET SINGLE GOAL
GET /goal/:goalId
*/
export const getGoalById = asyncHandler(async (req, res) => {

    const { goalId } = req.params;

    const goal = await Goal.findById(goalId)
        .populate("createdBy", "username email")
        .populate("circle", "name");

    if (!goal) {
        throw new ApiError(404, "Goal not found");
    }

    return res.status(200).json(
        new ApiResponse(200, goal, "Goal fetched successfully")
    );
});


/*
UPDATE GOAL
PATCH /goal/update/:goalId
*/
export const updateGoal = asyncHandler(async (req, res) => {

    const { goalId } = req.params;

    const goal = await Goal.findById(goalId);

    if (!goal) {
        throw new ApiError(404, "Goal not found");
    }

    if (goal.createdBy.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to update this goal");
    }

    const updatedGoal = await Goal.findByIdAndUpdate(
        goalId,
        req.body,
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, updatedGoal, "Goal updated successfully")
    );
});


/*
DELETE GOAL
DELETE /goal/delete/:goalId
*/
export const deleteGoal = asyncHandler(async (req, res) => {

    const { goalId } = req.params;

    const goal = await Goal.findById(goalId);

    if (!goal) {
        throw new ApiError(404, "Goal not found");
    }

    if (goal.createdBy.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to delete this goal");
    }

    await Goal.findByIdAndDelete(goalId);

    return res.status(200).json(
        new ApiResponse(200, {}, "Goal deleted successfully")
    );
});