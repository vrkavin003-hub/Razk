import { UserRound } from "lucide-react";
import { mediaUrl } from "../config/api";
import { initials } from "../utils/formatters";

export default function UserAvatar({ className = "", name = "", photo = "", size = "md" }) {
  const sizes = {
    lg: "h-16 w-16 text-lg",
    md: "h-10 w-10 text-sm",
    sm: "h-8 w-8 text-xs"
  };
  const src = mediaUrl(photo);

  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-700 font-black text-white ring-1 ring-slate-200 dark:bg-slate-200 dark:text-slate-950 ${sizes[size] || sizes.md} ${className}`}>
      {src ? <img alt={name || "User"} className="h-full w-full object-cover" src={src} /> : name ? initials(name) : <UserRound className="h-4 w-4" aria-hidden="true" />}
    </span>
  );
}
