import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config({ path: "./.env" });

const UserSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,      
    },
    streak: {
      type: Number,
      default: 0,
    },
    lastCheckInDate: {
      type: String, // "YYYY-MM-DD"
    },
    bookmarks: [
      {
        title: String,
        url: String,
      },
    ],

    // ── Google Calendar ──────────────────────────────────────────────────────
    googleAccessToken:  { type: String },
    googleRefreshToken: { type: String },
    googleTokenExpiry:  { type: Number },    // epoch ms
    googleCalendarId:   { type: String, default: "primary" },
    googleConnected:    { type: Boolean, default: false },
    // ────────────────────────────────────────────────────────────────────────

    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

UserSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id:      this._id,
      email:    this.email,
      username: this.username,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

UserSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { _id: this._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

export const User = mongoose.model("User", UserSchema);