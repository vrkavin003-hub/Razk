import api from "./api";
import { deleteUploadedFile, uploadFile } from "./upload";
import { createWatermarkedAttendancePhoto } from "../utils/attendancePhoto";
import { getDeviceInfo } from "../utils/device";

const baseAttendancePayload = ({ employeeId, location }) => ({
  employee_id: employeeId,
  accuracy: location.accuracy,
  latitude: location.latitude,
  locationStatus: location.locationStatus,
  longitude: location.longitude
});

export const submitAttendance = async ({
  attendancePhoto,
  attendanceSite,
  employeeId,
  location,
  path
}) => {
  const isCheckIn = path.includes("check-in");
  let uploadedPhoto = null;
  const payload = baseAttendancePayload({ employeeId, location });

  if (isCheckIn) {
    const watermarkedPhoto = await createWatermarkedAttendancePhoto(attendancePhoto.file, {
      capturedAt: attendancePhoto.capturedAt,
      location: attendancePhoto.location || location,
      site: attendanceSite
    });
    uploadedPhoto = await uploadFile(watermarkedPhoto, "image");
    payload.attendancePhoto = uploadedPhoto.url;
    payload.attendancePhotoDevice = getDeviceInfo().deviceName;
    payload.attendancePhotoCapturedAt = new Date(attendancePhoto.capturedAt).toISOString();
    payload.attendancePhotoProvider = uploadedPhoto.provider;
    payload.attendancePhotoPublicId = uploadedPhoto.publicId;
    payload.attendancePhotoResourceType = uploadedPhoto.resourceType;
    payload.attendanceSite = attendanceSite;
  }

  try {
    return await api.post(path, payload);
  } catch (error) {
    if (uploadedPhoto) {
      await deleteUploadedFile(uploadedPhoto).catch(() => false);
    }
    throw error;
  }
};
