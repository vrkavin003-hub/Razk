import assert from "node:assert/strict";
import fs from "node:fs";
import { announcementMessageParts } from "../../client/src/utils/announcementLinks.js";

const googleForm = "Please complete the form:\nhttps://forms.gle/AbCdEf123\nThank you.";
assert.deepEqual(announcementMessageParts(googleForm), [
  { type: "text", value: "Please complete the form:\n" },
  { type: "link", value: "https://forms.gle/AbCdEf123" },
  { type: "text", value: "\nThank you." }
]);

assert.deepEqual(announcementMessageParts("Open http://example.com now"), [
  { type: "text", value: "Open " },
  { type: "link", value: "http://example.com" },
  { type: "text", value: " now" }
]);

assert.deepEqual(announcementMessageParts("Visit https://example.com/test."), [
  { type: "text", value: "Visit " },
  { type: "link", value: "https://example.com/test" },
  { type: "text", value: "." }
]);

assert.deepEqual(announcementMessageParts("www.example.com is plain text"), [
  { type: "text", value: "www.example.com is plain text" }
]);

const rendererSource = fs.readFileSync(
  new URL("../../client/src/components/AnnouncementMessage.jsx", import.meta.url),
  "utf8"
);
const cardSource = fs.readFileSync(
  new URL("../../client/src/components/AnnouncementCard.jsx", import.meta.url),
  "utf8"
);
const dashboardSource = fs.readFileSync(
  new URL("../../client/src/pages/EmployeeDashboard.jsx", import.meta.url),
  "utf8"
);
const announcementsPageSource = fs.readFileSync(
  new URL("../../client/src/pages/Announcements.jsx", import.meta.url),
  "utf8"
);

assert.match(rendererSource, /target="_blank"/);
assert.match(rendererSource, /rel="noopener noreferrer"/);
assert.match(rendererSource, /whitespace-pre-wrap/);
assert.match(rendererSource, /break-all/);
assert.doesNotMatch(rendererSource, /dangerouslySetInnerHTML/);
assert.match(cardSource, /<AnnouncementMessage/);
assert.match(dashboardSource, /<AnnouncementMessage/);
assert.match(announcementsPageSource, /<textarea/);
assert.doesNotMatch(announcementsPageSource, /AnnouncementMessage/);

console.log("Announcement URL parsing checks passed");
