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
    decidedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("PermissionRequest", permissionRequestSchema);
