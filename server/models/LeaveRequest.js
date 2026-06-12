const mongoose = require("mongoose");

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    leaveType: {
      type: String,
      enum: ["Casual Leave", "Sick Leave", "Emergency Leave", "Paid Leave"],
      required: true
    },
    fromDate: {
      type: Date,
      required: true
    },
    toDate: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    attachment: String,
    requestedDays: Number,
    paidDays: Number,
    unpaidDays: Number,
    yearlyPaidLeaveUsed: Number,
    yearlyPaidLeaveRemaining: Number,
    limitExceeded: {
      type: Boolean,
      default: false
    },
    requestType: {
      type: String,
      default: "Leave"
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

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);
