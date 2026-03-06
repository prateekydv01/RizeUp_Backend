import { Router } from "express";
import {
    createGoal,
    getUserGoals,
    getGoalById,
    updateGoal,
    deleteGoal
} from "../controllers/goal.controller.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/create", verifyJWT, createGoal);
router.get("/user-goals", verifyJWT, getUserGoals);
router.get("/:goalId", verifyJWT, getGoalById);
router.patch("/update/:goalId", verifyJWT, updateGoal);
router.delete("/delete/:goalId", verifyJWT, deleteGoal);

export default router;
