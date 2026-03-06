import mongoose,{Schema} from "mongoose";

const CircleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },

    admin: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    goals: [
      {
        type: Schema.Types.ObjectId,
        ref: "Goal",
      },
    ],

    habits: [
      {
        type: Schema.Types.ObjectId,
        ref: "Habit",
      },
    ],

    leaderboard: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        score: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  { timestamps: true }
);


export const Circle = mongoose.model("Circle",CircleSchema)