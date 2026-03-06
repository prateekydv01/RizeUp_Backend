import mongoose, { Schema } from "mongoose";

const StageSchema = new Schema(
  {
    goalId: {
      type: Schema.Types.ObjectId,
      ref: "Goal",
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    durationDays: {
      type: Number,
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    completionDate: {
      type: Date,
    },

    proofUrl: {
      type: String,
    },

    verification: {
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      verifiedBy: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
    },
  },
  { timestamps: true }
);

export const Stage = mongoose.model("Stage", StageSchema);
