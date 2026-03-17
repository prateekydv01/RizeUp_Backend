import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  disconnectGoogle,
  getGoogleStatus,
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  googleSignIn,
  googleSignInCallback
} from "../controllers/google.controller.js";

const router = Router();

router.get("/auth/url",      googleSignIn);
router.get("/auth/callback", googleSignInCallback);

// Callback doesn't use verifyJWT — userId comes via OAuth state param
router.get("/callback", handleGoogleCallback);

// All other routes require auth
router.use(verifyJWT);

router.get   ("/auth-url",       getGoogleAuthUrl);
router.get   ("/status",         getGoogleStatus);
router.post  ("/disconnect",     disconnectGoogle);

router.get   ("/events",         getCalendarEvents);
router.post  ("/events",         createCalendarEvent);
router.patch ("/events/:eventId", updateCalendarEvent);
router.delete("/events/:eventId", deleteCalendarEvent);

export default router;