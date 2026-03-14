import mongoose, { Schema } from "mongoose";

const TodoSchema = new Schema(
{
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  section: {
    type: Schema.Types.ObjectId,
    ref: "TodoSection",
    required: true
  },

  title: {
    type: String,
    required: true,
    trim: true
  },

  completed: {
    type: Boolean,
    default: false
  }
},
{ timestamps: true }
);

export const Todo = mongoose.model("Todo", TodoSchema);