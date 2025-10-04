const mongoose = require("mongoose");
const Counter = require("./counter"); // make sure path is correct

const appointmentSchema = new mongoose.Schema({
  appointmentId: { type: String, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  purpose: { type: String, required: true, trim: true },
  paymentId: { type: String, default: "" },
  paymentStatus: { type: String, enum: ["Pending", "Paid", "Failed"], default: "Pending" },
  status: { type: String, enum: ["Upcoming", "Completed", "Cancelled", "Rescheduled"], default: "Upcoming" },
}, { timestamps: true });

// Prevent double booking
appointmentSchema.index({ admin: 1, startTime: 1, endTime: 1 }, { unique: true });

// ✅ Pre-save hook for appointmentId
appointmentSchema.pre("save", async function(next) {
  if (!this.appointmentId) {
    const counter = await Counter.findOneAndUpdate(
      { name: "appointmentId" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const sequenceNumber = String(counter.seq).padStart(2, "0");
    this.appointmentId = `AP-080513${sequenceNumber}`;
  }
  next();
});

module.exports = mongoose.models.Appointment || mongoose.model("Appointment", appointmentSchema);
