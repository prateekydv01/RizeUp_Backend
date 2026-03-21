import mongoose, { Schema } from "mongoose";

const HabitSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    circleId: {
      type: Schema.Types.ObjectId,
      ref: "Circle",        // only if type is "circle"
    },

    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",        // people who joined this habit
      }
    ],

    type: {
      type: String,
      enum: ["personal", "circle"],
      default: "personal",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    streak: {
      type: Number,
      default: 0,
    },

    lastCheckInDate: {
      type: String,
    },
  },
  { timestamps: true }
);

export const Habit = mongoose.model("Habit", HabitSchema);