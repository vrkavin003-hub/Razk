const mongoose = require("mongoose");

const odRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    odDate: {
      type: Date,
      required: true
    },
    fromTime: {
      type: String,
      required: true
    },
    toTime: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    attachment: String,
    requestType: {
      type: String,
      default: "OD"
    },
    requesterName: String,
    requesterRole: String,
    requesterDepartment: String,
    requestRaisedAt: Date,
    assignedApproverRole: String,
    assignedApprover: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    assignedApproverName: String,
    assignedDri: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    assignedDriName: String,
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending"
    },
    adminRemarks: String,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    decidedAt: Date,
    reactedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    reactedByName: String,
    reactedByRole: String,
    reactedAt: Date,
    approvalComment: String,
    rejectionReason: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("ODRequest", odRequestSchema);
