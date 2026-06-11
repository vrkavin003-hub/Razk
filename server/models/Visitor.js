const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema(
  {
    visitorName: {
      type: String,
      required: true,
      trim: true
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true
    },
    companyName: {
      type: String,
      trim: true
    },
    purposeOfVisit: {
      type: String,
      required: true,
      trim: true
    },
    personToMeet: {
      type: String,
      required: true,
      trim: true
    },
    checkInTime: Date,
    checkOutTime: Date,
    visitDate: {
      type: Date,
      required: true
    },
    visitorImage: String,
    remarks: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Visitor", visitorSchema);
