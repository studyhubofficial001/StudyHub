
const mongoose = require("mongoose");
const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, default: "" },
    // assistant messages: which notes the answer came from
    sources: { type: [Schema.Types.Mixed], default: [] },
    // user messages: what the student had selected when asking
    options: {
      subjectId: { type: String, default: null },
      subjectName: { type: String, default: null },
      marks: { type: Number, default: null },
    },
    error: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const chatSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

chatSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model("Chat", chatSchema);