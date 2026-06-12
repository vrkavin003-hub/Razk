const Attendance = require("../models/Attendance");
const ODRequest = require("../models/ODRequest");
const asyncHandler = require("../utils/asyncHandler");
const { toDateKey } = require("../utils/dates");
const {
  assertCanDecideRequest,
  createAssignedNotification,
  createDecisionNotifications,
  employeeFields,
  markDecision,
  populateRequestQuery,
  requestSnapshot,
  resolveRequestAssignment,
  visibilityQueryForUser
} = require("../utils/requestWorkflow");

const applyOD = asyncHandler(async (req, res) => {
  const { attachment, fromTime, location, odDate, reason, toTime } = req.body;
  if (!odDate || !fromTime || !toTime || !reason || !location) {
    res.status(400);
    throw new Error("OD date, from time, to time, reason, and location are required");
  }

  const assignment = await resolveRequestAssignment(req.user);
  const od = await ODRequest.create({
    ...assignment,
    ...requestSnapshot(req.user, "OD"),
    attachment,
    employee: req.user._id,
    fromTime,
    location,
    odDate,
    reason,
    toTime
  });

  await createAssignedNotification({
    request: od,
    requester: req.user,
    type: "od",
    title: "New OD request assigned",
    message: `${req.user.name} (${req.user.role?.toUpperCase()}) requested OD on ${odDate}.`
  });

  res.status(201).json({ od });
});

const myODRequests = asyncHandler(async (req, res) => {
  const requests = await populateRequestQuery(ODRequest.find({ employee: req.user._id })).sort({ createdAt: -1 });
  res.json({ requests });
});

const allODRequests = asyncHandler(async (req, res) => {
  const query = visibilityQueryForUser(req.user, req.query.status);
  const requests = await populateRequestQuery(ODRequest.find(query)).sort({ createdAt: -1 });
  res.json({ requests });
});

const decideOD = (status) =>
  asyncHandler(async (req, res) => {
    const od = await ODRequest.findById(req.params.id).populate("employee", employeeFields);
    if (!od) {
      res.status(404);
      throw new Error("OD request not found");
    }

    assertCanDecideRequest(req.user, od);

    markDecision(od, req.user, status, req.body.adminRemarks || req.body.remarks || "");
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
            shiftName: "OD",
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

    await createDecisionNotifications({
      request: od,
      actor: req.user,
      status,
      type: "od"
    });

    const populated = await populateRequestQuery(ODRequest.findById(od._id));
    res.json({ od: populated });
  });

module.exports = {
  allODRequests,
  applyOD,
  approveOD: decideOD("Approved"),
  myODRequests,
  rejectOD: decideOD("Rejected")
};
