const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");
const Admin = require("../models/Admin");
const User = require("../models/User");
const Counter = require("../models/counter"); // ensure this exists

// --------------------
// Book new appointment
// --------------------
router.post("/book", async (req, res) => {
  try {
    const { clientId, adminId, date, time, purpose, paymentId } = req.body;
    if (!clientId || !adminId || !date || !time || !purpose)
      return res.status(400).json({ message: "Missing required fields" });

    const user = await User.findOne({ clientId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const admin = await Admin.findOne({ adminId });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const startTime = new Date(`${date}T${time}:00`);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 min slot

    // Check overlapping appointments
    const overlapping = await Appointment.findOne({
      admin: admin._id,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      status: "Upcoming",
    });
    if (overlapping) return res.status(409).json({ message: "Time slot already booked" });

    // Generate appointmentId using counter
    const counter = await Counter.findOneAndUpdate(
      { name: "appointmentId" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const sequenceNumber = String(counter.seq).padStart(2, "0");
    const appointmentId = `AP-080513${sequenceNumber}`;

    const appointment = new Appointment({
      appointmentId,
      user: user._id,
      admin: admin._id,
      startTime,
      endTime,
      purpose,
      paymentId,
      status: "Upcoming",
    });

    await appointment.save();

    // Populate fields separately
    await appointment.populate("admin", "name specialty adminId");
    await appointment.populate("user", "name clientId email phone");

    res.status(201).json({ message: "Appointment booked successfully", appointment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// --------------------
// Fetch appointments by clientId
// --------------------
router.get("/byClient", async (req, res) => {
  try {
    const { clientId } = req.query;
    if (!clientId) return res.status(400).json({ message: "Client ID required" });

    const user = await User.findOne({ clientId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const appointments = await Appointment.find({ user: user._id })
      .populate("admin", "name specialty adminId")
      .populate("user", "name clientId email phone")
      .sort({ startTime: 1 });

    res.json({ appointments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// --------------------
// Fetch appointments by adminId
// --------------------
router.get("/byAdmin", async (req, res) => {
  try {
    const { adminId } = req.query;
    if (!adminId) return res.status(400).json({ message: "Admin ID required" });

    const admin = await Admin.findOne({ adminId });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const appointments = await Appointment.find({ admin: admin._id })
      .populate("user", "name clientId email phone")
      .populate("admin", "name specialty adminId")
      .sort({ startTime: 1 });

    res.json({ appointments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// --------------------
// Cancel appointment
// --------------------
router.post("/cancel", async (req, res) => {
  try {
    let { appointmentId, reason } = req.body;
    if (!appointmentId) return res.status(400).json({ message: "Appointment ID required" });

    // Accept either MongoDB _id or appointmentId
    const query = appointmentId.length === 24 ? { _id: appointmentId } : { appointmentId };

    const appointment = await Appointment.findOne(query);
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    appointment.status = "Cancelled";
    appointment.cancelReason = reason || "Cancelled by admin";
    await appointment.save();

    // Populate separately
    await appointment.populate("admin", "name specialty adminId");
    await appointment.populate("user", "name clientId email phone");

    res.json({ message: "Appointment cancelled successfully", appointment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// --------------------
// Reschedule appointment
// --------------------
router.post("/reschedule", async (req, res) => {
  try {
    let { appointmentId, date, time } = req.body;
    if (!appointmentId || !date || !time)
      return res.status(400).json({ message: "Appointment ID, date, and time required" });

    // Accept either MongoDB _id or appointmentId
    const query = appointmentId.length === 24 ? { _id: appointmentId } : { appointmentId };

    const appointment = await Appointment.findOne(query);
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    const newStartTime = new Date(`${date}T${time}:00`);
    const newEndTime = new Date(newStartTime.getTime() + 30 * 60 * 1000);

    // Check overlapping
    const overlapping = await Appointment.findOne({
      admin: appointment.admin,
      startTime: { $lt: newEndTime },
      endTime: { $gt: newStartTime },
      status: "Upcoming",
      _id: { $ne: appointment._id },
    });
    if (overlapping) return res.status(409).json({ message: "Time slot already booked" });

    appointment.startTime = newStartTime;
    appointment.endTime = newEndTime;
    appointment.status = "Rescheduled";
    await appointment.save();

    // Populate separately
    await appointment.populate("admin", "name specialty adminId");
    await appointment.populate("user", "name clientId email phone");

    res.json({ message: "Appointment rescheduled successfully", appointment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
