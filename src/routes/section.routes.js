import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";

import {
  createSection,
  getSections,
  updateSection,
  deleteSection
} from "../controllers/todoSection.controller.js";

const router = Router();

router.route("/create").post(verifyJWT, createSection);

router.route("/get-sections").get(verifyJWT, getSections);

router.route("/update/:sectionId").patch(verifyJWT, updateSection);

router.route("/delete/:sectionId").delete(verifyJWT, deleteSection);

export default router;