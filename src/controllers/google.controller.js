import { google } from "googleapis";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// ── OAuth2 client factory ─────────────────────────────────────────────────────

const getOAuthClient = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

// ── Build an authenticated client for a user ─────────────────────────────────

const getAuthedClient = async (user) => {
  const oauth2Client = getOAuthClient();

  oauth2Client.setCredentials({
    access_token:  user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
    expiry_date:   user.googleTokenExpiry,
  });

  // Auto-refresh if token expired
  if (user.googleTokenExpiry && Date.now() > user.googleTokenExpiry - 60_000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    user.googleAccessToken  = credentials.access_token;
    user.googleTokenExpiry  = credentials.expiry_date;
    await user.save({ validateBeforeSave: false });
    oauth2Client.setCredentials(credentials);
  }

  return oauth2Client;
};

// ── Step 1: Redirect user to Google consent screen ───────────────────────────

export const getGoogleAuthUrl = asyncHandler(async (req, res) => {
  const oauth2Client = getOAuthClient();

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",   // needed for refresh token
    prompt:      "consent",   // force consent so refresh token is always returned
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    state: req.user._id.toString(), // pass userId through OAuth flow
  });

  return res.status(200).json(new ApiResponse(200, { url }, "Auth URL generated"));
});

// ── Step 2: Google redirects back here with ?code= ───────────────────────────

export const handleGoogleCallback = asyncHandler(async (req, res) => {
  const { code, state: userId } = req.query;

  if (!code || !userId) throw new ApiError(400, "Missing code or state");

  const oauth2Client = getOAuthClient();
  const { tokens }   = await oauth2Client.getToken(code);

  // Save tokens to user
  await User.findByIdAndUpdate(userId, {
    googleAccessToken:  tokens.access_token,
    googleRefreshToken: tokens.refresh_token,
    googleTokenExpiry:  tokens.expiry_date,
    googleConnected:    true,
  });

  // Redirect back to planner
  res.redirect(`${process.env.FRONTEND_URL}/planner?googleConnected=true`);
});

// ── Disconnect Google ─────────────────────────────────────────────────────────

export const disconnectGoogle = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    googleAccessToken:  null,
    googleRefreshToken: null,
    googleTokenExpiry:  null,
    googleConnected:    false,
  });

  return res.status(200).json(new ApiResponse(200, {}, "Google Calendar disconnected"));
});

// ── Get connection status ─────────────────────────────────────────────────────

export const getGoogleStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("googleConnected");
  return res.status(200).json(new ApiResponse(200, { connected: user.googleConnected }, "Status fetched"));
});

// ── Fetch events (for planner view) ──────────────────────────────────────────
// Query: ?timeMin=ISO&timeMax=ISO

export const getCalendarEvents = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user.googleConnected) throw new ApiError(400, "Google Calendar not connected");

  const auth     = await getAuthedClient(user);
  const calendar = google.calendar({ version: "v3", auth });

  const now      = new Date();
  const monthOut = new Date(now);
  monthOut.setDate(monthOut.getDate() + 30);

  const { data } = await calendar.events.list({
    calendarId: user.googleCalendarId || "primary",
    timeMin:    req.query.timeMin || now.toISOString(),
    timeMax:    req.query.timeMax || monthOut.toISOString(),
    singleEvents: true,
    orderBy:    "startTime",
    maxResults: 50,
  });

  return res.status(200).json(new ApiResponse(200, data.items || [], "Events fetched"));
});

// ── Create a calendar event from a todo ──────────────────────────────────────
// Body: { title, date, time, duration (minutes), todoId }

export const createCalendarEvent = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user.googleConnected) throw new ApiError(400, "Google Calendar not connected");

  const { title, date, time = "09:00", duration = 60, todoId } = req.body;

  if (!title || !date) throw new ApiError(400, "title and date are required");

  const start = new Date(`${date}T${time}:00`);
  const end   = new Date(start.getTime() + duration * 60_000);

  const auth     = await getAuthedClient(user);
  const calendar = google.calendar({ version: "v3", auth });

  const { data: event } = await calendar.events.insert({
    calendarId: user.googleCalendarId || "primary",
    requestBody: {
      summary:     title,
      description: todoId ? `RizeUp Todo ID: ${todoId}` : "Created from RizeUp Planner",
      start: { dateTime: start.toISOString(), timeZone: "UTC" },
      end:   { dateTime: end.toISOString(),   timeZone: "UTC" },
      colorId: "6", // tangerine — closest to orange
    },
  });

  return res.status(201).json(new ApiResponse(201, event, "Event created in Google Calendar"));
});

// ── Update a calendar event ───────────────────────────────────────────────────

export const updateCalendarEvent = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user.googleConnected) throw new ApiError(400, "Google Calendar not connected");

  const { eventId } = req.params;
  const { title, date, time = "09:00", duration = 60 } = req.body;

  const start = new Date(`${date}T${time}:00`);
  const end   = new Date(start.getTime() + duration * 60_000);

  const auth     = await getAuthedClient(user);
  const calendar = google.calendar({ version: "v3", auth });

  const { data: event } = await calendar.events.patch({
    calendarId: user.googleCalendarId || "primary",
    eventId,
    requestBody: {
      summary: title,
      start: { dateTime: start.toISOString(), timeZone: "UTC" },
      end:   { dateTime: end.toISOString(),   timeZone: "UTC" },
    },
  });

  return res.status(200).json(new ApiResponse(200, event, "Event updated"));
});

// ── Delete a calendar event ───────────────────────────────────────────────────

export const deleteCalendarEvent = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user.googleConnected) throw new ApiError(400, "Google Calendar not connected");

  const { eventId } = req.params;

  const auth     = await getAuthedClient(user);
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.delete({
    calendarId: user.googleCalendarId || "primary",
    eventId,
  });

  return res.status(200).json(new ApiResponse(200, {}, "Event deleted from Google Calendar"));
});

// ── Google Sign-In (Auth) ─────────────────────────────────────────────────────

const AUTH_REDIRECT_URI = process.env.GOOGLE_AUTH_REDIRECT_URI ||
  `${process.env.BACKEND_URL || "http://localhost:4000"}/api/v1/google/auth/callback`;
 
const getAuthOAuthClient = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    AUTH_REDIRECT_URI
  );
 
export const googleSignIn = asyncHandler(async (req, res) => {
  const oauth2Client = getAuthOAuthClient();
 
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt:      "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ],
  });
 
  // Log so you can verify the redirect_uri being sent
  console.log("[GoogleSignIn] redirect_uri:", AUTH_REDIRECT_URI);
  console.log("[GoogleSignIn] auth url:", url);
 
  return res.status(200).json(new ApiResponse(200, { url }, "Google sign-in URL generated"));
});
 
export const googleSignInCallback = asyncHandler(async (req, res) => {
  const { code } = req.query;
  if (!code) throw new ApiError(400, "Missing code");
 
  const oauth2Client = getAuthOAuthClient();
  const { tokens }   = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
 
  // Fetch Google profile
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data: profile } = await oauth2.userinfo.get();
  const { id: googleId, email, name, given_name } = profile;
 
  // Find or create user
  let user = await User.findOne({ $or: [{ googleId }, { email }] });
 
  if (!user) {
    const baseUsername = (given_name || name || email.split("@")[0])
      .toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
 
    let username = baseUsername;
    let suffix   = 1;
    while (await User.findOne({ username })) {
      username = `${baseUsername}${suffix++}`;
    }
 
    user = await User.create({
      fullName:           name || given_name || "User",
      username,
      email,
      googleId,
      googleAccessToken:  tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
      googleTokenExpiry:  tokens.expiry_date,
      googleConnected:    true,
    });
  } else {
    user.googleId          = googleId;
    user.googleAccessToken = tokens.access_token;
    if (tokens.refresh_token) user.googleRefreshToken = tokens.refresh_token;
    user.googleTokenExpiry = tokens.expiry_date;
    user.googleConnected   = true;
    await user.save({ validateBeforeSave: false });
  }
 
  const accessToken  = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken  = refreshToken;
  await user.save({ validateBeforeSave: false });
 
  const cookieOptions = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
  };
 
  res
    .cookie("accessToken",  accessToken,  cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .redirect(`${process.env.FRONTEND_URL}/`);
});