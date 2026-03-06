import {Router} from "express"
import { verifyJWT } from "../middlewares/auth.middleware.js"
import { createTodo, deleteTodo, getTodos, getTodosByType, toggleTodo, updateTodo } from "../controllers/todo.controller.js"

const router = Router()

router.route("/create").post(verifyJWT,createTodo)
router.route("/get-all-todo").get(verifyJWT,getTodos)
router.route("/type/:type").get(verifyJWT, getTodosByType);
router.route("/update/:todoId").patch(verifyJWT, updateTodo);
router.route("/toggle/:todoId").patch(verifyJWT, toggleTodo);
router.route("/delete/:todoId").delete(verifyJWT, deleteTodo);

export default router