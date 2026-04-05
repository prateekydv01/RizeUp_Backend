import mongoose, { Schema } from "mongoose";

const completionRequestSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  proof: {
    type: String, // image/video URL
    required: true
  },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },

  approvals: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    }
  ],

  rejections: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    }
  ],

  completedAt: Date
}, { timestamps: true });


const goalSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    startDate: {
      type: Date,
      required: true
    },

    endDate: {
      type: Date,
      required: true
    },

    resources: [
    {
      name: {
        type: String,
        required: true
      },
      url: {
        type: String,
        required: true
      }
    }
  ],

    type: {
      type: String,
      enum: ["personal", "circle"],
      default: "personal"
    },

    circleId: {
      type: Schema.Types.ObjectId,
      ref: "Circle",
      default: null
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    members:[{
      type:Schema.Types.ObjectId,
      ref:"User",
    }],

    // ✅ Final completion (approved or direct)
    completedBy: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User"
        },
        completedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    completionRequests: [completionRequestSchema],

    status: {
      type: String,
      enum: ["active", "completed", "backlog"],
      default: "active"
    }

  },
  { timestamps: true }
);


// 🔥 Indexes (VERY IMPORTANT for performance)
goalSchema.index({ createdBy: 1 });
goalSchema.index({ circleId: 1 });
goalSchema.index({ type: 1 });

export const Goal = mongoose.model("Goal", goalSchema);