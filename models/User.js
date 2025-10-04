const mongoose = require("mongoose");

// ✅ Define Counter model safely inside User.js
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

// Use mongoose.models to avoid OverwriteModelError
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// User (Client) schema
const userSchema = new mongoose.Schema(
  {
    clientId: { type: String, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "Client" },
  },
  { timestamps: true }
);

// Pre-save middleware to generate unique clientId
userSchema.pre("save", async function (next) {
  if (!this.clientId) {
    const counter = await Counter.findOneAndUpdate(
      { name: "clientId" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const sequenceNumber = String(counter.seq).padStart(2, "0");
    this.clientId = `CL-080513${sequenceNumber}`;
  }
  next();
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
