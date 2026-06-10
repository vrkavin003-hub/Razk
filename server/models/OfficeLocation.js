const mongoose = require("mongoose");

const officeLocationSchema = new mongoose.Schema(
  {
    officeName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    radiusMeters: {
      type: Number,
      required: true,
      min: 1,
      max: 5000
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    }
  },
  { timestamps: true }
);

officeLocationSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model("OfficeLocation", officeLocationSchema);
