const mongoose = require("mongoose");

const permissionRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    permissionType: {
      type: String,
      enum: ["Late Coming", "Early Leaving", "Personal Permission", "Official Work"],
      required: true
    },
    date: {
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
    requestedHours: Number,
    paidHours: Number,
    unpaidHours: Number,
    monthlyPaidPermissionUsed: Number,
    monthlyPaidPermissionRemaining: Number,
    limitExceeded: {
      type: Boolean,
      default: false
    },
    requestType: {
      type: String,
      default: "Permission"
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

module.exports = mongoose.model("PermissionRequest", permissionRequestSchema);
