import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isNativeMobile } from "../config/api";

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to prepare file for download"));
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(blob);
  });

const downloadInBrowser = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

const shareInBrowser = async (blob, filename, mimeType) => {
  if (!navigator.share || typeof File === "undefined") return false;
  const file = new File([blob], filename, { type: mimeType });
  if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
  await navigator.share({ files: [file], title: filename });
  return true;
};

const shareInNativeApp = async (blob, filename, mimeType) => {
  const data = await blobToBase64(blob);
  const saved = await Filesystem.writeFile({
    path: filename,
    data,
    directory: Directory.Cache,
    recursive: true
  });

  await Share.share({
    title: filename,
    text: "Razk Automation attendance report",
    url: saved.uri,
    dialogTitle: `Open or share ${mimeType.includes("pdf") ? "PDF" : "Excel"} report`
  });
};

export const saveReportFile = async ({ blob, filename, mimeType }) => {
  if (isNativeMobile()) {
    await shareInNativeApp(blob, filename, mimeType);
    return;
  }

  if (await shareInBrowser(blob, filename, mimeType)) return;
  downloadInBrowser(blob, filename);
};
