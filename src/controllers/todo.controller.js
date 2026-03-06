import { Todo } from "../models/todo.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

/**
 * CREATE TODO
 */
export const createTodo = asyncHandler(async (req, res) => {
  const { title, type } = req.body;

  if (!title) {
    throw new ApiError(400, "Todo title is required");
  }

  const todo = await Todo.create({
    title,
    type,
    user: req.user._id,
  });

  return res.status(201).json(
    new ApiResponse(201, todo, "Todo created successfully")
  );
});

/**
 * GET ALL TODOS OF USER
 */
export const getTodos = asyncHandler(async (req, res) => {
  const todos = await Todo.find({ user: req.user._id });

  return res.status(200).json(
    new ApiResponse(200, todos, "Todos fetched successfully")
  );
});

/**
 * UPDATE TODO (title / type)
 */
export const updateTodo = asyncHandler(async (req, res) => {
  const { todoId } = req.params;
  const { title, type } = req.body;

  const todo = await Todo.findOneAndUpdate(
    { _id: todoId, user: req.user._id },
    { title, type },
    { new: true }
  );

  if (!todo) {
    throw new ApiError(404, "Todo not found");
  }

  return res.status(200).json(
    new ApiResponse(200, todo, "Todo updated successfully")
  );
});

/**
 * TOGGLE COMPLETE / INCOMPLETE
 */
export const toggleTodo = asyncHandler(async (req, res) => {
  const { todoId } = req.params;

  const todo = await Todo.findOne({ _id: todoId, user: req.user._id });

  if (!todo) {
    throw new ApiError(404, "Todo not found");
  }

  todo.completed = !todo.completed;
  await todo.save();

  return res.status(200).json(
    new ApiResponse(200, todo, "Todo status updated")
  );
});

/**
 * DELETE TODO
 */
export const deleteTodo = asyncHandler(async (req, res) => {
  const { todoId } = req.params;

  const todo = await Todo.findOneAndDelete({
    _id: todoId,
    user: req.user._id,
  });

  if (!todo) {
    throw new ApiError(404, "Todo not found");
  }

  return res.status(200).json(
    new ApiResponse(200, null, "Todo deleted successfully")
  );
});


/**
 * GET TODOS BY TYPE
 */
export const getTodosByType = asyncHandler(async (req, res) => {
  const { type } = req.params;

  if (!type) {
    throw new ApiError(400, "Todo type is required");
  }

  const todos = await Todo.find({
    user: req.user._id,
    type: type,
  });

  return res.status(200).json(
    new ApiResponse(200, todos, "Todos fetched by type successfully")
  );
});