import mongoose, { Schema } from "mongoose";

const TodoSectionSchema = new Schema(
{
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  title: {
    type: String,
    required: true
  },

  type: {
    type: String,
    enum: ["daily", "weekly", "monthly", "semester", "custom"],
    default: "custom"
  },

  isDefault: {
    type: Boolean,
    default: false
  }
},
{ timestamps: true }
);

export const TodoSection = mongoose.model("TodoSection", TodoSectionSchema);