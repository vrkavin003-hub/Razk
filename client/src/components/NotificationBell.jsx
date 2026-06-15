import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../services/api";
import TimeAgo from "./TimeAgo";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wrapperRef = useRef(null);

  const loadNotifications = async () => {
    try {
      const { data } = await api.get("/notifications", { params: { type: "announcement" } });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const close = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const dismissNotification = async (notification) => {
    try {
      if (!notification.isRead) await api.put(`/notifications/${notification._id}/read`);
      setNotifications((current) => current.filter((item) => item._id !== notification._id));
      if (!notification.isRead) setUnreadCount((current) => Math.max(current - 1, 0));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      await api.put("/notifications/mark-all-read", null, { params: { type: "announcement" } });
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const removeNotification = async (notification) => {
    try {
      await api.delete(`/notifications/${notification._id}`);
      await loadNotifications();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        aria-label="Notifications"
        className="relative inline-grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-900/5 transition hover:border-hya-100 hover:bg-hya-50 hover:text-hya-700 focus:outline-none focus:ring-4 focus:ring-hya-100 dark:border-[#203e6f] dark:bg-[#0c1f3d] dark:text-blue-100 dark:shadow-none dark:hover:bg-[#123052] dark:focus:ring-[#24456f]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-hya-600 px-1 text-xs font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,400px)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-panel dark:border-[#203e6f] dark:bg-[#0c1f3d] dark:shadow-none">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[#203e6f]">
            <div>
              <p className="text-sm font-black text-slate-950 dark:text-slate-100">Notifications</p>
              <p className="text-xs text-slate-500 dark:text-slate-300">{unreadCount} unread</p>
            </div>
            <button
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-hya-700 hover:bg-hya-50 disabled:opacity-50 dark:text-blue-100 dark:hover:bg-[#123052]"
              disabled={loading || unreadCount === 0}
              onClick={markAllRead}
              type="button"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length ? (
              notifications.map((notification) => (
                <div
                  className={`flex items-start border-b border-slate-100 transition hover:bg-hya-50 dark:border-[#203e6f] dark:hover:bg-[#102a47] ${
                    notification.isRead ? "bg-white dark:bg-[#0c1f3d]" : "bg-hya-50/80 dark:bg-[#123052]"
                  }`}
                  key={notification._id}
                >
                  <button
                    className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left"
                    onClick={() => dismissNotification(notification)}
                    type="button"
                  >
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        notification.isRead ? "bg-slate-300 dark:bg-[#24456f]" : "bg-hya-600 dark:bg-blue-200"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-slate-950 dark:text-slate-100">{notification.title}</span>
                      <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-100">
                        {notification.message}
                      </span>
                      <span className="mt-2 block text-xs font-semibold text-slate-400 dark:text-slate-300">
                        {notification.createdBy?.name || "System"} | <TimeAgo value={notification.createdAt} />
                      </span>
                    </span>
                  </button>
                  <button
                    aria-label="Delete notification"
                    className="mr-3 mt-3 rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100 dark:text-blue-200 dark:hover:bg-[#123052] dark:hover:text-rose-200"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeNotification(notification);
                    }}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-300">
                No new notifications
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
