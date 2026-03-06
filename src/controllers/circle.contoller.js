import { Circle } from "../models/circle.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateCircleCode = async () => {
  const lastCircle = await Circle.findOne()
    .sort({ createdAt: -1 })
    .select("code");

  if (!lastCircle) {
    return "C1000";
  }

  const lastNumber = parseInt(lastCircle.code.substring(1));
  return `C${lastNumber + 1}`;
};


export const createCircle = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name) {
    throw new ApiError(400, "Circle name is required");
  }

  const code = await generateCircleCode();

  const circle = await Circle.create({
    name,
    code,
    admin: req.user._id,
    members: [req.user._id],
  });

  return res.status(201).json(
    new ApiResponse(201, circle, "Circle created successfully")
  );
});

/**
 * GET ALL CIRCLES OF USER
 */
export const getUserCircles = asyncHandler(async (req, res) => {
  const circles = await Circle.find({
    members: req.user._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, circles, "Circles fetched successfully"));
});

/**
 * GET SINGLE CIRCLE BY ID
 */
export const getCircleById = asyncHandler(async (req, res) => {
  const { circleId } = req.params;

  const circle = await Circle.findById(circleId)
    .populate("members", "username email")
    // .populate("goals")
    // .populate("habits");

  if (!circle) {
    throw new ApiError(404, "Circle not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, circle, "Circle fetched successfully"));
});

/**
 * JOIN CIRCLE BY CODE
 */
export const joinCircle = asyncHandler(async (req, res) => {
  const { code } = req.body;

  const circle = await Circle.findOne({ code });

  if (!circle) {
    throw new ApiError(404, "Invalid circle code");
  }

  if (circle.members.includes(req.user._id)) {
    throw new ApiError(400, "Already a member of this circle");
  }

  circle.members.push(req.user._id);
  await circle.save();

  return res
    .status(200)
    .json(new ApiResponse(200, circle, "Joined circle successfully"));
});

/**
 * LEAVE CIRCLE
 */
export const leaveCircle = asyncHandler(async (req, res) => {
  const { circleId } = req.params;

  const circle = await Circle.findById(circleId);

  if (!circle) {
    throw new ApiError(404, "Circle not found");
  }

  circle.members = circle.members.filter(
    (member) => member.toString() !== req.user._id.toString()
  );

  await circle.save();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Left circle successfully"));
});

/**
 * DELETE CIRCLE (ADMIN ONLY)
 */
export const deleteCircle = asyncHandler(async (req, res) => {
  const { circleId } = req.params;

  const circle = await Circle.findById(circleId);

  if (!circle) {
    throw new ApiError(404, "Circle not found");
  }

  if (circle.admin.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only admin can delete this circle");
  }

  await circle.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Circle deleted successfully"));
});
