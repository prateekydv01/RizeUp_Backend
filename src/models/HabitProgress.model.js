import mongoose, { Schema } from "mongoose";

const HabitProgressSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    habitId: {
      type: Schema.Types.ObjectId,
      ref: "Habit",
      required: true,
    },

    streak: {
      type: Number,
      default: 0,
    },

    lastCheckInDate: {
      type: String, // YYYY-MM-DD
    },
  },
  { timestamps: true }
);

// One progress per user per habit
HabitProgressSchema.index(
  { userId: 1, habitId: 1 },
  { unique: true }
);

export const HabitProgress = mongoose.model("HabitProgress", HabitProgressSchema);