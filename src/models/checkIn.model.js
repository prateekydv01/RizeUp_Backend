import mongoose, { Schema } from "mongoose";

const CheckInSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    entityType: {
      type: String,
      enum: ["habit", "stage", "goal"],
      required: true,
    },

    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },

    completed: {
      type: Boolean,
      default: true,
    },

    proofUrl: {
      type: String,
    },

    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
    },

    circleId: {
      type: Schema.Types.ObjectId,
      ref: "Circle",
    },
  },
  { timestamps: true }
);

CheckInSchema.index(
  { userId: 1, entityId: 1, date: 1 },
  { unique: true }
);

export const CheckIn = mongoose.model("CheckIn", CheckInSchema);
