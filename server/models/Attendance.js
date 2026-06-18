const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    employeeId: {
      type: String,
      required: true
    },
    date: {
      type: String,
      required: true
    },
    checkIn: Date,
    shiftName: {
      type: String,
      default: "Not marked",
      trim: true
    },
    checkInLatitude: Number,
    checkInLongitude: Number,
    checkInAccuracy: Number,
    checkInLocationStatus: {
      type: String,
      enum: ["Captured", "Permission denied", "Location not available", "Inside", "Outside", "Unknown"],
      default: "Location not available"
    },
    checkInLocationCapturedAt: Date,
    checkInDistanceMeters: Number,
    attendanceSite: {
      type: String,
      enum: ["Chennai", "Hosur"]
    },
    checkInPhoto: String,
    checkInPhotoDevice: String,
    checkInPhotoCapturedAt: Date,
    checkOut: Date,
    checkOutLatitude: Number,
    checkOutLongitude: Number,
    checkOutAccuracy: Number,
    checkOutLocationStatus: {
      type: String,
      enum: ["Captured", "Permission denied", "Location not available", "Inside", "Outside", "Unknown"],
      default: "Location not available"
    },
    checkOutLocationCapturedAt: Date,
    checkOutDistanceMeters: Number,
    workingHours: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Half Day", "Late", "OD", "Leave", "Missed", "Week Off"],
      default: "Present"
    },
    locationNote: String,
    remarks: String,
    statusUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    statusUpdatedAt: Date,
    statusUpdateReason: String
  },
  { timestamps: true }
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
