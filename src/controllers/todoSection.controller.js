import { TodoSection } from "../models/todoSection.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// create section
export const createSection = asyncHandler(async (req, res) => {
  const { title, type } = req.body;

  if (!title) {
    throw new ApiError(400, "Section title is required");
  }

  const section = await TodoSection.create({
    title,
    type,
    user: req.user._id
  });

  return res.status(201).json(
    new ApiResponse(201, section, "Section created successfully")
  );
});


// get all user's todo sections
export const getSections = asyncHandler(async (req, res) => {

  let sections = await TodoSection.find({
    user: req.user._id
  });

  if (sections.length === 0) {

    sections = await TodoSection.insertMany([
      { title: "Today", type: "daily", user: req.user._id, isDefault: true },
      { title: "Weekly", type: "weekly", user: req.user._id, isDefault: true },
      { title: "Monthly", type: "monthly", user: req.user._id, isDefault: true },
      { title: "Semester", type: "semester", user: req.user._id, isDefault: true }
    ]);

  }

  return res.status(200).json(
    new ApiResponse(200, sections, "Sections fetched successfully")
  );
});


// update section
export const updateSection = asyncHandler(async (req, res) => {

  const { sectionId } = req.params;
  const { title } = req.body;

  const section = await TodoSection.findOneAndUpdate(
    { _id: sectionId, user: req.user._id },
    { title },
    { new: true }
  );

  if (!section) {
    throw new ApiError(404, "Section not found");
  }

  return res.status(200).json(
    new ApiResponse(200, section, "Section updated successfully")
  );
});


// delete section
export const deleteSection = asyncHandler(async (req, res) => {

  const { sectionId } = req.params;

  const section = await TodoSection.findOneAndDelete({
    _id: sectionId,
    user: req.user._id
  });

  if (!section) {
    throw new ApiError(404, "Section not found");
  }

  return res.status(200).json(
    new ApiResponse(200, null, "Section deleted successfully")
  );
});