const Visitor = require("../models/Visitor");
const asyncHandler = require("../utils/asyncHandler");

const normalizeVisitorPayload = (body) => ({
  checkInTime: body.checkInTime || null,
  checkOutTime: body.checkOutTime || null,
  companyName: body.companyName || "",
  mobileNumber: body.mobileNumber,
  personToMeet: body.personToMeet,
  purposeOfVisit: body.purposeOfVisit,
  remarks: body.remarks || "",
  visitDate: body.visitDate,
  visitorImage: body.visitorImage || "",
  visitorName: body.visitorName
});

const listVisitors = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.date) {
    const from = new Date(req.query.date);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);
    query.visitDate = { $gte: from, $lte: to };
  }
  const visitors = await Visitor.find(query)
    .populate("createdBy", "name role")
    .populate("updatedBy", "name role")
    .sort({ visitDate: -1, createdAt: -1 });
  res.json({ visitors });
});

const createVisitor = asyncHandler(async (req, res) => {
  const payload = normalizeVisitorPayload(req.body);
  if (!payload.visitorName || !payload.mobileNumber || !payload.purposeOfVisit || !payload.personToMeet || !payload.visitDate) {
    res.status(400);
    throw new Error("Visitor name, mobile number, purpose, person to meet, and visit date are required");
  }
  const visitor = await Visitor.create({ ...payload, createdBy: req.user._id, updatedBy: req.user._id });
  res.status(201).json({ visitor });
});

const updateVisitor = asyncHandler(async (req, res) => {
  const visitor = await Visitor.findById(req.params.id);
  if (!visitor) {
    res.status(404);
    throw new Error("Visitor record not found");
  }
  Object.assign(visitor, normalizeVisitorPayload({ ...visitor.toObject(), ...req.body }), { updatedBy: req.user._id });
  await visitor.save();
  res.json({ visitor });
});

const deleteVisitor = asyncHandler(async (req, res) => {
  const visitor = await Visitor.findById(req.params.id);
  if (!visitor) {
    res.status(404);
    throw new Error("Visitor record not found");
  }
  await visitor.deleteOne();
  res.json({ message: "Visitor record deleted" });
});

module.exports = {
  createVisitor,
  deleteVisitor,
  listVisitors,
  updateVisitor
};
