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
    checkOut: Date,
    workingHours: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Half Day", "Late"],
      default: "Present"
    },
    locationNote: String,
    remarks: String
  },
  { timestamps: true }
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
