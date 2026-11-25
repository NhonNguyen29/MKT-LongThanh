export function vietnamDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function weekStart(date: string) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function addDays(date: string, n: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const platforms = [
  { name: "Hashnode", url: "https://hashnode.com/" },
  {
    name: "Gravatar",
    url: "https://gravatar.com/profile",
    note: "Kiểm tra hình thức cập nhật hồ sơ trước khi dùng; có thể đổi nền tảng trong tuần.",
  },
  { name: "LinkedIn", url: "https://www.linkedin.com/feed/" },
  { name: "Instagram", url: "https://www.instagram.com/" },
  { name: "Pinterest", url: "https://www.pinterest.com/" },
  {
    name: "Tumblr",
    url: "https://www.tumblr.com/",
    note: "Cần bật fake IP theo ghi chú của chủ trung tâm.",
  },
  { name: "Threads", url: "https://www.threads.com/" },
  { name: "X", url: "https://x.com/" },
  { name: "Dribbble", url: "https://dribbble.com/" },
  { name: "Diigo", url: "https://www.diigo.com/" },
  { name: "Instapaper", url: "https://www.instapaper.com/" },
];
export function weeklyRotation(week: string) {
  const weeks = Math.floor(
    (Date.parse(week) - Date.parse("2026-11-23")) / (7 * 86400000),
  );
  const offset =
    (((weeks * 3) % platforms.length) + platforms.length) % platforms.length;
  return [0, 1, 2].map((i) => platforms[(offset + i) % platforms.length].name);
}
