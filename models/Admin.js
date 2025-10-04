const mongoose = require("mongoose");

// ✅ Counter schema to keep track of last sequence
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

// ✅ Prevent OverwriteModelError
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// Admin schema
const adminSchema = new mongoose.Schema({
  adminId: { type: String, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: "Admin" },
  permissions: [String],
  specialty: { type: String, default: "" },
  description: { type: String, default: "" },
  fee: { type: Number, default: 0 },
  experience: { type: String, default: "" },
  famousFor: { type: String, default: "" },
  availability: {
    workingDays: { type: String, default: "" },
    workingHours: { type: String, default: "" },
    breakTime: { type: String, default: "" },
  },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: String, default: "" },
});

// Pre-save middleware to generate unique adminId
adminSchema.pre("save", async function (next) {
  if (!this.adminId) {
    const counter = await Counter.findOneAndUpdate(
      { name: "adminId" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const sequenceNumber = String(counter.seq).padStart(2, "0");
    this.adminId = `AD-080513${sequenceNumber}`;
  }
  next();
});

module.exports = mongoose.models.Admin || mongoose.model("Admin", adminSchema);
