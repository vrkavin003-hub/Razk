import { announcementMessageParts } from "../utils/announcementLinks";

export default function AnnouncementMessage({ className = "", message = "" }) {
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {announcementMessageParts(message).map((part, index) =>
        part.type === "link" ? (
          <a
            className="break-all font-semibold text-hya-700 underline decoration-hya-300 underline-offset-2 hover:text-hya-900 dark:text-blue-200 dark:decoration-blue-400 dark:hover:text-white"
            href={part.value}
            key={`${index}-${part.value}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            {part.value}
          </a>
        ) : (
          part.value
        )
      )}
    </p>
  );
}
