import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createGoal,
  getMyGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
  markGoalComplete,
  verifyProof,
} from "../controllers/goal.controller.js";

const router = Router();
router.use(verifyJWT);

router.post  ("/",                              createGoal);
router.get   ("/",                              getMyGoals);
router.get   ("/:goalId",                       getGoalById);
router.patch ("/:goalId",                       updateGoal);
router.delete("/:goalId",                       deleteGoal);
router.post  ("/:goalId/complete",              markGoalComplete);
router.post  ("/:goalId/verify/:requestId",     verifyProof);

export default router;