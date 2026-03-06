import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";

import {
  createCircle,
  getUserCircles,
  getCircleById,
  joinCircle,
  leaveCircle,
  deleteCircle
} from "../controllers/circle.contoller.js";

const router = Router();

router.route("/create")
  .post(verifyJWT, createCircle);

router.route("/get-user-circles")
  .get(verifyJWT, getUserCircles);

router.route("/:circleId")
  .get(verifyJWT, getCircleById);

router.route("/join")
  .post(verifyJWT, joinCircle);

router.route("/leave/:circleId")
  .patch(verifyJWT, leaveCircle);

router.route("/delete/:circleId")
  .delete(verifyJWT, deleteCircle);

export default router;
