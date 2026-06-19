const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Full name is required"],
      trim: true
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false
    },
    role: {
      type: String,
      enum: ["admin", "hr", "employee", "dri"],
      default: "employee"
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    department: {
      type: String,
      trim: true
    },
    designation: {
      type: String,
      trim: true
    },
    assignedShift: {
      type: String,
      enum: ["", "1st Shift", "2nd Shift", "3rd Shift", "General Shift"],
      default: ""
    },
    weeklyWeekOffDay: {
      type: String,
      enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      default: "Sunday"
    },
    phone: {
      type: String,
      trim: true
    },
    joiningDate: Date,
    address: String,
    emergencyContact: String,
    profilePhoto: String,
    registeredDeviceId: {
      type: String,
      trim: true
    },
    registeredDeviceName: {
      type: String,
      trim: true
    },
    deviceRegisteredAt: Date,
    deviceApprovalStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none"
    },
    pendingDeviceId: {
      type: String,
      trim: true
    },
    pendingDeviceName: {
      type: String,
      trim: true
    },
    deviceRequestedAt: Date,
    deviceApprovedAt: Date,
    deviceApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    deviceRejectedAt: Date,
    deviceRejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    deviceResetAt: Date,
    deviceResetBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date
  },
  { timestamps: true }
);

userSchema.index({ deviceApprovalStatus: 1, deviceRequestedAt: 1 });

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = function matchPassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toJSON = function toJSON() {
  const user = this.toObject();
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  delete user.registeredDeviceId;
  delete user.pendingDeviceId;
  return user;
};

module.exports = mongoose.model("User", userSchema);
