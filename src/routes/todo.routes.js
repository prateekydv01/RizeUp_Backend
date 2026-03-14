import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";

import {
  createTodo,
  getSectionTodos,
  updateTodo,
  toggleTodo,
  deleteTodo
} from "../controllers/todo.controller.js";

const router = Router();

router.route("/create").post(verifyJWT, createTodo);

router.route("/section/:sectionId").get(verifyJWT, getSectionTodos);

router.route("/update/:todoId").patch(verifyJWT, updateTodo);

router.route("/toggle/:todoId").patch(verifyJWT, toggleTodo);

router.route("/delete/:todoId").delete(verifyJWT, deleteTodo);

export default router;