const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");
const ODRequest = require("../models/ODRequest");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { toDateKey } = require("../utils/dates");

const employeeFields = "name email employeeId department designation profilePhoto";

const applyOD = asyncHandler(async (req, res) => {
  const { attachment, fromTime, location, odDate, reason, toTime } = req.body;
  if (!odDate || !fromTime || !toTime || !reason || !location) {
    res.status(400);
    throw new Error("OD date, from time, to time, reason, and location are required");
  }

  const od = await ODRequest.create({
    attachment,
    employee: req.user._id,
    fromTime,
    location,
    odDate,
    reason,
    toTime
  });

  const reviewers = await User.find({ role: { $in: ["admin", "hr"] }, isActive: true }).select("_id");
  if (reviewers.length) {
    await Notification.insertMany(
      reviewers.map((reviewer) => ({
        user: reviewer._id,
        title: "New OD request",
        message: `${req.user.name} requested OD on ${odDate}.`,
        type: "od",
        createdBy: req.user._id
      }))
    );
  }

  res.status(201).json({ od });
});

const myODRequests = asyncHandler(async (req, res) => {
  const requests = await ODRequest.find({ employee: req.user._id })
    .populate("employee", employeeFields)
    .populate("approvedBy", "name role")
    .sort({ createdAt: -1 });
  res.json({ requests });
});

const allODRequests = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  const requests = await ODRequest.find(query)
    .populate("employee", employeeFields)
    .populate("approvedBy", "name role")
    .sort({ createdAt: -1 });
  res.json({ requests });
});

const decideOD = (status) =>
  asyncHandler(async (req, res) => {
    const od = await ODRequest.findById(req.params.id).populate("employee", employeeFields);
    if (!od) {
      res.status(404);
      throw new Error("OD request not found");
    }

    od.status = status;
    od.adminRemarks = req.body.adminRemarks || req.body.remarks || "";
    od.approvedBy = req.user._id;
    od.decidedAt = new Date();
    await od.save();

    if (status === "Approved") {
      const date = toDateKey(new Date(od.odDate));
      await Attendance.findOneAndUpdate(
        { employee: od.employee._id, date },
        {
          $setOnInsert: {
            employee: od.employee._id,
            employeeId: od.employee.employeeId || String(od.employee._id),
            date,
            checkIn: new Date(`${date}T${od.fromTime}:00`),
            checkOut: new Date(`${date}T${od.toTime}:00`),
            checkInLocationStatus: "Location not available",
            checkOutLocationStatus: "Location not available",
            workingHours: 0
          },
          $set: {
            remarks: `OD Approved: ${od.location} - ${od.reason}`,
            status: "OD"
          }
        },
        { new: true, upsert: true }
      );
    }

    await Notification.create({
      user: od.employee._id,
      title: `OD ${status.toLowerCase()}`,
      message: `Your OD request was ${status.toLowerCase()} by ${req.user.name}.`,
      type: "od",
      createdBy: req.user._id
    });

    const populated = await ODRequest.findById(od._id)
      .populate("employee", employeeFields)
      .populate("approvedBy", "name role");
    res.json({ od: populated });
  });

module.exports = {
  allODRequests,
  applyOD,
  approveOD: decideOD("Approved"),
  myODRequests,
  rejectOD: decideOD("Rejected")
};
