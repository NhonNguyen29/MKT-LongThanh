"use client";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Users,
  FolderOpen,
  Settings,
  Bell,
  Search,
  Plus,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  MessageSquare,
  LogOut,
  ShieldCheck,
  Activity,
  CheckCircle2,
  FileText,
  Send,
  X,
  AlertCircle,
  RefreshCw,
  Globe,
  Menu,
  PauseCircle,
  Filter,
  Download,
  Image as ImageIcon,
} from "lucide-react";
import { MediaVault } from "@/components/media-vault";
import type {
  Snapshot,
  Task,
  SafeUser,
  Status,
  Publication,
} from "@/lib/types";
import { addDays } from "@/lib/calendar";
type View =
  | "overview"
  | "tasks"
  | "calendar"
  | "social"
  | "media"
  | "team"
  | "library"
  | "build"
  | "settings";
const labels: Record<Status, string> = {
  todo: "Chưa làm",
  doing: "Đang làm",
  review: "Chờ duyệt",
  changes: "Cần chỉnh sửa",
  done: "Hoàn thành",
  paused: "Tạm dừng",
};
const pubs: Record<Publication, string> = {
  draft: "Bản nháp",
  approved: "Đã duyệt",
  delivered: "Đã bàn giao",
  published: "Đã xuất bản",
};
const roles = {
  owner: "Chủ trung tâm",
  manager: "Quản lý",
  employee: "Nhân viên",
};
const nav = [
  { id: "overview", title: "Tổng quan", icon: LayoutDashboard },
  { id: "tasks", title: "Công việc", icon: ListTodo },
  { id: "calendar", title: "Lịch công việc", icon: CalendarDays },
  { id: "social", title: "Social hằng tuần", icon: Globe },
  { id: "media", title: "Kho Ảnh & Video", icon: ImageIcon },
  { id: "team", title: "Nhân sự & phân quyền", icon: Users },
  { id: "library", title: "Thư viện nội dung", icon: FolderOpen },
  { id: "build", title: "Tiến trình xây dựng", icon: Activity },
  { id: "settings", title: "Cài đặt & nhắc nhở", icon: Settings },
] as const;
const channels = [
  "Facebook",
  "Google Maps",
  "TikTok",
  "Social",
  "YouTube",
  "SEO Website",
  "Thiết kế",
  "Kho Media",
  "Vận hành",
];
const fmt = (s: string | null) =>
  s
    ? new Date(s + "T12:00:00").toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      })
    : "Chưa đặt hạn";
const initials = (s: string) =>
  s
    .split(" ")
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
function Badge({ status }: { status: Status }) {
  return (
    <span className={"badge " + status}>
      <i />
      {labels[status]}
    </span>
  );
}
function Channel({ name }: { name: string }) {
  return (
    <span className={"channel " + name.replaceAll(" ", "-").toLowerCase()}>
      {name}
    </span>
  );
}
function Progress({ value }: { value: number }) {
  return (
    <div className="progress-line">
      <div className="progress-track">
        <i style={{ width: value + "%" }} />
      </div>
      <span>{value}%</span>
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Đóng" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Login({ onLogin }: { onLogin: () => void }) {
  const [local, setLocal] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setLocal(d.localTest))
      .catch(() => {});
  }, []);
  async function login(payload: object) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-screen">
      <div className="login-intro">
        <img src="/logo.png" alt="Sao Việt" />
        <span className="eyebrow">MARKETING HUB · LONG THÀNH</span>
        <h1>
          Mọi công việc.
          <br />
          Một nơi quản lý.
        </h1>
        <p>
          Giao đúng người, duyệt đúng lúc.
          <br />
          Cùng đội ngũ giữ nhịp Marketing mỗi ngày.
        </p>
        <div className="login-feature">
          <ShieldCheck /> Quyền truy cập theo vai trò <CheckCircle2 /> Lưu tiến
          độ thực tế
        </div>
      </div>
      <div className="login-card">
        <span className="test-label">
          {local ? "BẢN TEST" : "SAO VIỆT · NỘI BỘ"}
        </span>
        <h2>Chào mừng trở lại</h2>
        <p>Đăng nhập để mở không gian làm việc Sao Việt.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            login({ email: f.get("email"), password: f.get("password") });
          }}
        >
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="username"
              placeholder="ten@congty.vn"
              required
            />
          </label>
          <label>
            Mật khẩu
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
        {local && (
          <div className="test-access">
            <strong>Trải nghiệm nhanh trên máy này</strong>
            <p>
              Các nút TEST chỉ có ở môi trường local. Quyền vẫn được kiểm tra
              tại máy chủ.
            </p>
            <div className="test-buttons">
              {(["owner", "manager", "employee"] as const).map((role) => (
                <button
                  key={role}
                  disabled={busy}
                  onClick={() => login({ testRole: role })}
                >
                  {roles[role]}
                </button>
              ))}
            </div>
          </div>
        )}
        <small>
          Dữ liệu công việc được lưu riêng. Không tự động đăng nội dung lên các
          kênh.
        </small>
      </div>
    </div>
  );
}
export default function Dashboard() {
  const [data, setData] = useState<Snapshot | null>(null),
    [auth, setAuth] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [view, setView] = useState<View>("overview"),
    [query, setQuery] = useState(""),
    [statusFilter, setStatusFilter] = useState("all"),
    [channelFilter, setChannelFilter] = useState("all"),
    [selected, setSelected] = useState<string | null>(null),
    [create, setCreate] = useState(false),
    [newUser, setNewUser] = useState(false),
    [toast, setToast] = useState(""),
    [notice, setNotice] = useState(false),
    [mobile, setMobile] = useState(false),
    [busy, setBusy] = useState(false),
    [mediaJump, setMediaJump] = useState<{
      year: number;
      month: number;
    } | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      if (r.status === 401) {
        setAuth(false);
        setData(null);
        return;
      }
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setData(d);
      setAuth(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    const focus = () => load();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (
      !data ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    const daily = data.notifications.find(
      (n) => n.id === "daily-" + data.today && !n.read,
    );
    if (daily) {
      const key = "mkt-notified-" + data.user.id + "-" + data.today;
      if (!localStorage.getItem(key)) {
        new Notification("Sao Việt · Công việc hôm nay", {
          body: "Mở bảng điều hành để xem việc đến hạn và nội dung chờ duyệt.",
        });
        localStorage.setItem(key, "1");
      }
    }
  }, [data]);
  async function action(action: string, payload: unknown) {
    setBusy(true);
    try {
      const r = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await load();
      setToast(
        d.email?.failed
          ? "Đã lưu công việc. Email chưa gửi được; xem nhật ký Gmail."
          : d.email && !d.email.configured
            ? "Đã lưu công việc. Email đang chờ cấu hình Gmail."
            : d.email?.sent
              ? `Đã lưu công việc; Gmail đã nhận gửi ${d.email.sent} thông báo.`
              : "Đã lưu thay đổi",
      );
      return true;
    } catch (e) {
      setToast((e as Error).message);
      await load();
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    setData(null);
    setAuth(false);
  }
  if (loading)
    return (
      <div className="loading">
        <div className="spinner" />
        Đang mở không gian làm việc…
      </div>
    );
  if (!auth || !data)
    return (
      <>
        {error && (
          <div className="global-error">
            {error} <button onClick={load}>Thử lại</button>
          </div>
        )}
        <Login onLogin={load} />
      </>
    );
  const manage = data.user.role !== "employee",
    owner = data.user.role === "owner";
  const active = data.tasks.filter((t) => !t.archived),
    unfinished = active.filter((t) => t.status !== "done"),
    review = active.filter((t) => t.status === "review"),
    done = active.filter((t) => t.status === "done"),
    due = unfinished.filter((t) => t.dueDate && t.dueDate <= data.today),
    unread = data.notifications.filter((n) => !n.read).length;
  const filtered = (
    view === "library"
      ? data.tasks.filter((t) => t.archived || t.status === "done")
      : active
  ).filter(
    (t) =>
      (statusFilter === "all" || t.status === statusFilter) &&
      (channelFilter === "all" || t.channel === channelFilter) &&
      (t.title + " " + t.id + " " + t.description)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const current = data.tasks.find((t) => t.id === selected);
  const weekTasks = data.tasks.filter((t) => t.week === data.week);
  const stageDone = data.build.filter((s) => s.status === "done").length;
  const navigate = (v: View) => {
    setView(v);
    setMobile(false);
    setStatusFilter("all");
    setChannelFilter("all");
    setQuery("");
  };
  function table(tasks: Task[]) {
    return tasks.length ? (
      <div className="table-wrap">
        <table className="task-table">
          <thead>
            <tr>
              <th>Công việc</th>
              <th>Người phụ trách</th>
              <th>Trạng thái</th>
              <th>Tiến độ</th>
              <th>Hạn xử lý</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} onClick={() => setSelected(t.id)}>
                <td>
                  <div className="task-title">
                    <span
                      className={
                        "task-symbol " + (t.status === "done" ? "finished" : "")
                      }
                    >
                      <FileText size={18} />
                    </span>
                    <div>
                      <button
                        className="text-btn task-open"
                        onClick={() => setSelected(t.id)}
                      >
                        {t.title}
                      </button>
                      <div className="task-meta">
                        <span>{t.id.startsWith("DK01-") ? "DK01" : t.id}</span>
                        <Channel name={t.channel} />
                        {t.priority === "high" && (
                          <span className="priority">Ưu tiên cao</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  {t.assignee ? (
                    <span className="person">
                      <i>
                        {initials(
                          data!.users.find((u) => u.id === t.assignee)?.name ||
                            "?",
                        )}
                      </i>
                      {data!.users.find((u) => u.id === t.assignee)?.name ||
                        "Tài khoản cũ"}
                    </span>
                  ) : (
                    <span className="muted">Chưa phân công</span>
                  )}
                </td>
                <td>
                  <Badge status={t.status} />
                </td>
                <td>
                  <Progress value={t.progress} />
                </td>
                <td
                  className={
                    t.dueDate && t.dueDate < data!.today && t.status !== "done"
                      ? "overdue"
                      : ""
                  }
                >
                  {fmt(t.dueDate)}
                </td>
                <td>
                  <ChevronRight size={17} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="empty">
        <ListTodo size={32} />
        <h3>Chưa có công việc phù hợp</h3>
        <p>
          {manage
            ? "Thử đổi bộ lọc hoặc tạo công việc mới."
            : "Việc được giao cho bạn sẽ xuất hiện tại đây."}
        </p>
      </div>
    );
  }
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "is-open" : "")}>
        <div className="brand">
          <img src="/logo.png" alt="Sao Việt" />
          <span>MARKETING HUB</span>
        </div>
        <div className="workspace">
          <div className="workspace-icon">SV</div>
          <div>
            <strong>Sao Việt Long Thành</strong>
            <small>Không gian điều hành</small>
          </div>
        </div>
        <div className="nav-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav>
          {nav
            .filter((n) => manage || !["team", "build"].includes(n.id))
            .map((n) => (
              <button
                key={n.id}
                className={view === n.id ? "active" : ""}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={19} />
                <span>{n.title}</span>
                {n.id === "tasks" && <b>{unfinished.length}</b>}
                {n.id === "build" && data.localTest && (
                  <i className="nav-new">TEST</i>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-footer">
          <div className="scope-note">
            <ShieldCheck size={18} />
            <span>
              {roles[data.user.role]}
              <small>
                {data.storage === "local"
                  ? "Dữ liệu lưu trên máy"
                  : "Dữ liệu dùng chung"}
              </small>
            </span>
          </div>
          <button className="user-card" onClick={() => navigate("settings")}>
            <span className="avatar">{initials(data.user.name)}</span>
            <span>
              <strong>{data.user.name}</strong>
              <small>{roles[data.user.role]}</small>
            </span>
          </button>
          <button className="logout" onClick={logout}>
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </aside>
      {mobile && (
        <div className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <main>
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Mở menu"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Không gian làm việc <ChevronRight size={14} />
            <strong>{nav.find((n) => n.id === view)?.title}</strong>
          </div>
          <div className="top-actions">
            <span className="saved">
              <CheckCircle2 size={15} /> Đã đồng bộ
            </span>
            <button
              className="icon-btn"
              aria-label="Tải lại dữ liệu"
              onClick={load}
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="icon-btn bell"
              aria-label="Thông báo"
              onClick={() => setNotice(!notice)}
            >
              <Bell size={20} />
              {unread > 0 && <span>{unread}</span>}
            </button>
            <span className="avatar small">{initials(data.user.name)}</span>
          </div>
        </header>
        {error && <div className="inline-error">{error}</div>}
        {notice && (
          <div className="notifications">
            <div className="section-head">
              <h3>Thông báo</h3>
              <button
                className="text-btn"
                onClick={() =>
                  action("readNotifications", {
                    ids: data.notifications.map((n) => n.id),
                  })
                }
              >
                Đánh dấu đã đọc
              </button>
            </div>
            {data.notifications.length ? (
              data.notifications.map((n) => (
                <button
                  className={"notification " + (!n.read ? "unread" : "")}
                  key={n.id}
                  onClick={() => {
                    action("readNotifications", { ids: [n.id] });
                    if (n.taskId) setSelected(n.taskId);
                    setNotice(false);
                  }}
                >
                  <Bell size={17} />
                  <span>
                    <strong>{n.title}</strong>
                    <small>{n.body}</small>
                  </span>
                </button>
              ))
            ) : (
              <p className="muted">Bạn đã xem hết việc cần chú ý.</p>
            )}
          </div>
        )}
        <div className="page">
          <div className="page-head">
            <div>
              <div className="eyebrow">
                SAO VIỆT · LONG THÀNH{" "}
                <span className="test-label">
                  {data.localTest ? "TEST" : "NỘI BỘ"}
                </span>
              </div>
              <h1>
                {view === "overview"
                  ? "Mỗi ngày, một bước tiến."
                  : nav.find((n) => n.id === view)?.title}
              </h1>
              <p>
                {view === "overview"
                  ? "Nắm tiến độ, kết nối đội ngũ và giữ mọi công việc đúng nhịp."
                  : view === "social"
                    ? "3 bài mỗi tuần · 3 nền tảng khác nhau · luân phiên 11 nền tảng."
                    : view === "team"
                      ? "Giao đúng người. Quyền hạn rõ ràng cho từng thành viên."
                      : view === "build"
                        ? "Tiến độ triển khai thực tế của hệ thống."
                        : "Theo dõi và cập nhật công việc tại một nơi."}
              </p>
            </div>
            <div className="head-actions">
              <span className="date-chip">
                <CalendarDays size={17} />
                {new Date(data.today + "T12:00:00").toLocaleDateString(
                  "vi-VN",
                  { day: "2-digit", month: "long", year: "numeric" },
                )}
              </span>
              {manage && ["overview", "tasks"].includes(view) && (
                <button className="primary" onClick={() => setCreate(true)}>
                  <Plus size={18} />
                  Tạo công việc
                </button>
              )}
            </div>
          </div>
          {view === "overview" && (
            <>
              <div className="stats">
                <Stat
                  title="Công việc đang mở"
                  number={unfinished.length}
                  detail={`${active.length} công việc trong danh sách`}
                  icon={<ListTodo />}
                  color="purple"
                />
                <Stat
                  title="Nội dung chờ duyệt"
                  number={review.length}
                  detail="Cần phản hồi để tiếp tục"
                  icon={<Clock />}
                  color="amber"
                />
                <Stat
                  title="Hoàn thành sản xuất"
                  number={done.length}
                  detail="Tách biệt với việc đã xuất bản"
                  icon={<CheckCircle2 />}
                  color="green"
                />
                <Stat
                  title="Social tuần này"
                  number={`${data.socialCompleted}/3`}
                  detail="Bài đã ghi nhận kèm URL"
                  icon={<Globe />}
                  color="blue"
                />
              </div>
              <div className="overview-grid">
                <div>
                  <section className="panel">
                    <div className="section-head">
                      <div>
                        <h2>Cần chú ý hôm nay</h2>
                        <p>Đến hạn, cần duyệt và những việc ưu tiên.</p>
                      </div>
                      <button
                        className="text-btn"
                        onClick={() => navigate("tasks")}
                      >
                        Xem tất cả <ChevronRight size={16} />
                      </button>
                    </div>
                    {table(
                      [
                        ...new Map(
                          [
                            ...due,
                            ...review,
                            ...unfinished.filter((t) => t.priority === "high"),
                          ].map((t) => [t.id, t]),
                        ).values(),
                      ].slice(0, 6),
                    )}
                  </section>
                  <section className="panel weekly-preview">
                    <div className="section-head">
                      <div>
                        <h2>Nhịp social hằng tuần</h2>
                        <p>
                          Tuần {fmt(data.week)} – {fmt(addDays(data.week, 6))}
                        </p>
                      </div>
                      <button
                        className="text-btn"
                        onClick={() => navigate("social")}
                      >
                        Quản lý tuần <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="social-mini-grid">
                      {weekTasks.map((t, i) => (
                        <button
                          className="social-mini"
                          key={t.id}
                          onClick={() => setSelected(t.id)}
                        >
                          <span className={"platform-icon p" + i}>
                            {t.platform?.slice(0, 2)}
                          </span>
                          <strong>{t.platform}</strong>
                          <small>{pubs[t.publication]}</small>
                          <Badge status={t.status} />
                        </button>
                      ))}
                      {!weekTasks.length && (
                        <p className="muted">
                          Bạn chưa được giao bài social tuần này.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
                <div className="right-rail">
                  <section className="focus-card">
                    <span className="eyebrow">GÓC ĐIỀU HÀNH</span>
                    <h2>
                      Rõ tiến độ.
                      <br />
                      Đúng người.
                    </h2>
                    <p>
                      {
                        active.filter((t) => !t.assignee && t.status !== "done")
                          .length
                      }{" "}
                      công việc đang mở chưa được phân công.
                    </p>
                    <button onClick={() => navigate("tasks")}>
                      Xem danh sách giao việc
                    </button>
                    <div className="focus-shape">
                      <span />
                      <span />
                      <span />
                    </div>
                  </section>
                  <section className="panel">
                    <div className="section-head">
                      <h2>Hoạt động gần đây</h2>
                      <Activity size={18} />
                    </div>
                    <div className="activity-list">
                      {data.audit.slice(0, 5).map((a) => (
                        <div className="activity" key={a.id}>
                          <i />
                          <div>
                            <strong>{a.actor}</strong>
                            <p>{a.message}</p>
                            <small>
                              {new Date(a.at).toLocaleString("vi-VN", {
                                timeZone: "Asia/Ho_Chi_Minh",
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <div className="reminder-note">
                    <Bell size={19} />
                    <div>
                      <strong>
                        Nhắc việc lúc {data.settings.reminderTime}
                      </strong>
                      <p>Giờ Việt Nam · trong web khi truy cập.</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {["tasks", "library"].includes(view) && (
            <section className="panel">
              <div className="filters">
                <div className="search">
                  <Search size={18} />
                  <input
                    aria-label="Tìm công việc"
                    placeholder="Tìm theo tên, mã công việc…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <label className="filter">
                  <Filter size={16} />
                  <select
                    aria-label="Lọc trạng thái"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">Mọi trạng thái</option>
                    {Object.entries(labels).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <select
                  aria-label="Lọc kênh"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                >
                  <option value="all">Tất cả kênh</option>
                  {[...channels, "Thư viện"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <span className="muted">{filtered.length} công việc</span>
              </div>
              {view === "library" && (
                <p className="panel-hint">
                  Nội dung đã hoàn thành hoặc lưu trữ. Trạng thái “Đã xuất bản”
                  chỉ được ghi khi có URL xác minh.
                </p>
              )}
              {table(filtered)}
            </section>
          )}
          {view === "calendar" && (
            <>
              <div className="calendar-grid">
                {Array.from({ length: 7 }, (_, i) => {
                  const date = addDays(data.week, i);
                  const list = active.filter((t) => t.dueDate === date);
                  return (
                    <section
                      className={
                        "calendar-day " + (date === data.today ? "today" : "")
                      }
                      key={date}
                    >
                      <div>
                        <strong>
                          {
                            [
                              "Thứ Hai",
                              "Thứ Ba",
                              "Thứ Tư",
                              "Thứ Năm",
                              "Thứ Sáu",
                              "Thứ Bảy",
                              "Chủ nhật",
                            ][i]
                          }
                        </strong>
                        <span>{fmt(date)}</span>
                      </div>
                      {list.map((t) => (
                        <button key={t.id} onClick={() => setSelected(t.id)}>
                          <Channel name={t.channel} />
                          <strong>{t.title}</strong>
                          <Badge status={t.status} />
                        </button>
                      ))}
                      {!list.length && <small>Chưa đặt lịch</small>}
                    </section>
                  );
                })}
              </div>
              <section className="panel">
                <div className="section-head">
                  <h2>Chưa có ngày đến hạn</h2>
                  <span className="muted">
                    Không tự đặt hạn cho nội dung chưa chốt lịch
                  </span>
                </div>
                {table(active.filter((t) => !t.dueDate && t.status !== "done"))}
              </section>
            </>
          )}
          {view === "social" && (
            <>
              <div className="social-banner">
                <div>
                  <span className="eyebrow">
                    TUẦN {fmt(data.week)} – {fmt(addDays(data.week, 6))}
                  </span>
                  <h2>Ít hơn, nhưng đều đặn.</h2>
                  <p>
                    Mỗi vị trí là một bài trên một nền tảng. Có thể đổi nền tảng
                    khi giao việc, nhưng không trùng trong tuần.
                  </p>
                </div>
                <div className="weekly-number">
                  <strong>
                    {data.socialCompleted}
                    <span>/3</span>
                  </strong>
                  <small>đã xuất bản có xác minh</small>
                </div>
              </div>
              <div className="social-cards">
                {weekTasks.map((t, i) => (
                  <section key={t.id} className="panel social-card">
                    <span className={"platform-icon p" + i}>
                      {t.platform?.slice(0, 2)}
                    </span>
                    <h2>{t.platform}</h2>
                    <Badge status={t.status} />
                    <p>
                      {t.assignee
                        ? data.users.find((u) => u.id === t.assignee)?.name
                        : "Chưa giao nhân viên"}
                    </p>
                    <Progress value={t.progress} />
                    <div className="publication-line">
                      <span>Xuất bản</span>
                      <strong>{pubs[t.publication]}</strong>
                    </div>
                    {t.publishedUrl && (
                      <a href={t.publishedUrl} target="_blank" rel="noreferrer">
                        Xem bài đã đăng <ExternalLink size={15} />
                      </a>
                    )}
                    <button
                      className="secondary full"
                      onClick={() => setSelected(t.id)}
                    >
                      Mở công việc
                    </button>
                  </section>
                ))}
              </div>
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Danh sách nền tảng luân phiên</h2>
                    <p>
                      Luân phiên theo thứ tự; quản lý có thể chọn nền tảng phù
                      hợp nội dung.
                    </p>
                  </div>
                </div>
                <div className="platform-list">
                  {data.platforms.map((p) => (
                    <div key={p.name}>
                      <a href={p.url} target="_blank" rel="noreferrer">
                        {p.name}
                        <ExternalLink size={14} />
                      </a>
                      {p.note && <small>{p.note}</small>}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {view === "team" && manage && (
            <>
              <div className="role-cards">
                {(["owner", "manager", "employee"] as const).map((r) => (
                  <section className="panel role-card" key={r}>
                    <ShieldCheck size={24} />
                    <h2>{roles[r]}</h2>
                    <p>
                      {r === "owner"
                        ? "Toàn quyền công việc, tài khoản, phân quyền và cấu hình nhắc nhở."
                        : r === "manager"
                          ? "Xem toàn bộ, tạo việc, phân công, phản hồi và nghiệm thu nội dung."
                          : "Chỉ xem việc được giao; cập nhật tiến độ, bình luận và gửi duyệt."}
                    </p>
                  </section>
                ))}
              </div>
              <section className="panel">
                <div className="section-head">
                  <h2>Thành viên ({data.users.length})</h2>
                  {owner && (
                    <button
                      className="primary"
                      onClick={() => setNewUser(true)}
                    >
                      <Plus size={17} />
                      Thêm thành viên
                    </button>
                  )}
                </div>
                <div className="member-list">
                  {data.users.map((u) => (
                    <div className="member" key={u.id}>
                      <span className="avatar">{initials(u.name)}</span>
                      <div>
                        <strong>{u.name}</strong>
                        <small>{u.email}</small>
                      </div>
                      <span
                        className={
                          "access-state " + (u.active ? "" : "inactive")
                        }
                      >
                        {u.active ? "Đang hoạt động" : "Đã khóa"}
                      </span>
                      {owner && u.role !== "owner" ? (
                        <>
                          <select
                            aria-label={"Vai trò của " + u.name}
                            value={u.role}
                            onChange={(e) =>
                              action("updateUser", {
                                id: u.id,
                                role: e.target.value,
                              })
                            }
                          >
                            <option value="manager">Quản lý</option>
                            <option value="employee">Nhân viên</option>
                          </select>
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() =>
                              action("updateUser", {
                                id: u.id,
                                active: !u.active,
                              })
                            }
                          >
                            {u.active ? "Khóa truy cập" : "Mở truy cập"}
                          </button>
                        </>
                      ) : (
                        <span className="role-pill">{roles[u.role]}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {view === "media" && (
            <MediaVault
              key={
                mediaJump ? `${mediaJump.year}-${mediaJump.month}` : "default"
              }
              items={data.mediaItems || []}
              tasks={data.tasks}
              users={data.users}
              currentUserId={data.user.id}
              manage={manage}
              busy={busy}
              initialFolder={mediaJump}
              onReload={load}
              onAction={action}
              onOpenTask={(id) => setSelected(id)}
            />
          )}
          {view === "build" && manage && (
            <>
              <div className="build-summary">
                <div>
                  <h2>
                    {stageDone}/{data.build.length} hạng mục hoàn thành
                  </h2>
                  <p>
                    Trạng thái cập nhật theo các hạng mục đã triển khai và kiểm
                    tra.
                  </p>
                </div>
                <div className="build-progress">
                  <Progress
                    value={Math.round((stageDone / data.build.length) * 100)}
                  />
                </div>
              </div>
              <div className="build-list">
                {data.build.map((s) => (
                  <section className="panel build-row" key={s.id}>
                    <span className={"build-symbol " + s.status}>
                      {s.status === "done" ? (
                        <CheckCircle2 />
                      ) : s.status === "doing" ? (
                        <RefreshCw />
                      ) : (
                        <Clock />
                      )}
                    </span>
                    <div>
                      <h2>{s.title}</h2>
                      <p>{s.detail}</p>
                    </div>
                    <span
                      className={
                        "badge " + (s.status === "pending" ? "todo" : s.status)
                      }
                    >
                      {s.status === "done"
                        ? "Hoàn thành"
                        : s.status === "doing"
                          ? "Đang triển khai"
                          : "Chưa triển khai"}
                    </span>
                  </section>
                ))}
              </div>
            </>
          )}
          {view === "settings" && (
            <div className="settings-grid">
              <section className="panel settings-card">
                <Bell size={25} />
                <h2>Nhắc việc hằng ngày</h2>
                <p>
                  Hiển thị việc đến hạn và cần duyệt khi bạn mở web. Thông báo
                  trình duyệt hoạt động khi web đang mở.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    action("settings", {
                      reminderTime: new FormData(e.currentTarget).get(
                        "reminderTime",
                      ),
                    });
                  }}
                >
                  <label>
                    Giờ nhắc (Việt Nam)
                    <input
                      type="time"
                      name="reminderTime"
                      defaultValue={data.settings.reminderTime}
                      disabled={!owner}
                      required
                    />
                  </label>
                  {owner && (
                    <button className="primary" disabled={busy}>
                      Lưu lịch nhắc
                    </button>
                  )}
                </form>
                <button
                  className="secondary"
                  onClick={async () => {
                    if (typeof Notification === "undefined") {
                      setToast("Trình duyệt này chưa hỗ trợ thông báo.");
                      return;
                    }
                    const result = await Notification.requestPermission();
                    setToast(
                      result === "granted"
                        ? "Đã bật thông báo trình duyệt"
                        : "Chưa cấp quyền thông báo",
                    );
                  }}
                >
                  Bật thông báo trên máy
                </button>
              </section>
              <section className="panel settings-card">
                <Globe size={25} />
                <h2>Thông báo công việc qua Gmail</h2>
                <p>
                  Báo giao việc, kết quả chờ duyệt, yêu cầu sửa và nghiệm thu.
                  Lịch email nhắc việc hằng ngày: 09:00 giờ Việt Nam, độc lập
                  với giờ nhắc trong web. Gửi từ{" "}
                  <strong>{data.gmailSender}</strong>.
                </p>
                <div className="integration">
                  <strong>Gmail nhân viên</strong>
                  <span>
                    {data.gmailConfigured
                      ? "Đã cấu hình"
                      : "Chưa cấu hình App Password"}
                  </span>
                </div>
                {manage && (
                  <button
                    className="primary"
                    disabled={busy || !data.gmailConfigured}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const r = await fetch("/api/notify", {
                          method: "POST",
                        });
                        const d = await r.json();
                        await load();
                        if (!r.ok) {
                          setToast(
                            d.error || "Không gửi được email nhắc việc.",
                          );
                        } else if (d.failed) {
                          setToast(
                            `Gmail đã nhận ${d.sent} email; ${d.failed} email lỗi. Xem nhật ký bên dưới.`,
                          );
                        } else if (d.sent === 0) {
                          setToast(
                            "Không có việc cần nhắc hoặc lượt nhắc này đã được gửi trong 5 phút vừa qua.",
                          );
                        } else {
                          setToast(
                            `Gmail đã nhận gửi ${d.sent} email nhắc việc.`,
                          );
                        }
                      } catch {
                        setToast("Lỗi kết nối khi gửi email.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Gửi email nhắc việc cho nhân viên ngay
                  </button>
                )}
                {manage && (
                  <button
                    className="secondary"
                    disabled={busy || !data.gmailConfigured}
                    style={{ marginTop: 12 }}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const r = await fetch("/api/notify", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ mode: "test" }),
                        });
                        const d = await r.json();
                        await load();
                        setToast(
                          !r.ok
                            ? d.error
                            : d.failed
                              ? "Gửi thử thất bại. Xem nhật ký Gmail."
                              : d.sent
                                ? "Gmail đã nhận email kiểm tra gửi tới tài khoản của bạn."
                                : "Lượt kiểm tra này đã được gửi trong phút vừa qua.",
                        );
                      } catch {
                        setToast(
                          "Chưa xác nhận được kết quả gửi. Xem nhật ký trước khi thử lại.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Gửi email kiểm tra cho tôi
                  </button>
                )}
                {manage && (
                  <div style={{ marginTop: 20 }}>
                    <h3>Nhật ký gửi Gmail</h3>
                    <p className="muted">
                      “Gmail đã nhận gửi” xác nhận máy chủ SMTP chấp nhận email,
                      chưa xác nhận người nhận đã đọc hoặc thư vào Inbox.
                    </p>
                    {!(data.emailLog || []).length && <p>Chưa có lượt gửi.</p>}
                    {(data.emailLog || []).slice(0, 15).map((e) => (
                      <div key={e.id} className="comment">
                        <strong>
                          {e.recipientName} ·{" "}
                          {
                            {
                              assigned: "Giao việc",
                              review: "Chờ duyệt",
                              changes: "Cần sửa",
                              done: "Nghiệm thu",
                              daily: "Nhắc hằng ngày",
                              manual: "Nhắc thủ công",
                              test: "Kiểm tra Gmail",
                            }[e.kind]
                          }
                        </strong>
                        <p>
                          {
                            {
                              pending: "Đang chờ gửi",
                              sending: "Đang gửi / chờ xác nhận",
                              sent: "Gmail đã nhận gửi",
                              failed: "Gửi lỗi",
                              skipped:
                                "Đã bỏ qua vì công việc hoặc quyền đã thay đổi",
                            }[e.status]
                          }
                          {e.taskId ? " · " + e.taskId : ""}
                        </p>
                        {e.error && <p>{e.error}</p>}
                        <small>
                          {new Date(e.updatedAt).toLocaleString("vi-VN", {
                            timeZone: "Asia/Ho_Chi_Minh",
                          })}
                        </small>
                        {owner && ["failed", "pending"].includes(e.status) && (
                          <button
                            className="text-btn"
                            disabled={busy || !data.gmailConfigured}
                            onClick={async () => {
                              if (
                                e.status === "failed" &&
                                !window.confirm(
                                  "Kiểm tra hộp thư trước để tránh gửi trùng. Bạn muốn gửi lại email này?",
                                )
                              )
                                return;
                              setBusy(true);
                              try {
                                const r = await fetch("/api/notify", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    mode: "retry",
                                    id: e.id,
                                  }),
                                });
                                const d = await r.json();
                                await load();
                                setToast(
                                  !r.ok
                                    ? d.error
                                    : d.failed
                                      ? "Chưa gửi được. Xem nhật ký."
                                      : d.sent
                                        ? "Gmail đã nhận gửi email."
                                        : "Không còn lượt gửi phù hợp.",
                                );
                              } catch {
                                setToast(
                                  "Chưa xác nhận kết quả. Hãy kiểm tra nhật ký.",
                                );
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            Gửi lại
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="panel settings-card">
                <ShieldCheck size={25} />
                <h2>Đổi mật khẩu</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (
                      await action("changePassword", {
                        oldPassword: f.get("oldPassword"),
                        newPassword: f.get("newPassword"),
                      })
                    ) {
                      setAuth(false);
                      setData(null);
                    }
                  }}
                >
                  <label>
                    Mật khẩu hiện tại
                    <input
                      type="password"
                      name="oldPassword"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  <label>
                    Mật khẩu mới (tối thiểu 12 ký tự)
                    <input
                      type="password"
                      name="newPassword"
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    Đổi mật khẩu
                  </button>
                </form>
              </section>
              <section className="panel settings-card">
                <FolderOpen size={25} />
                <h2>Dữ liệu & môi trường</h2>
                <p>
                  {data.storage === "local"
                    ? "Bản TEST đang lưu dữ liệu trên máy này. Dữ liệu vẫn còn sau khi tải lại trang."
                    : "Công việc được lưu trong PostgreSQL dùng chung."}
                </p>
                <div className="integration">
                  <strong>Vercel</strong>
                  <span>
                    {data.storage === "local"
                      ? "Chưa kết nối"
                      : "Cấu hình theo môi trường"}
                  </span>
                </div>
                {manage && (
                  <button
                    className="secondary"
                    onClick={() => {
                      const blob = new Blob(
                        [
                          JSON.stringify(
                            {
                              exportedAt: new Date().toISOString(),
                              tasks: data.tasks,
                              audit: data.audit,
                            },
                            null,
                            2,
                          ),
                        ],
                        { type: "application/json" },
                      );
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = "sao-viet-cong-viec-" + data.today + ".json";
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                    }}
                  >
                    <Download size={17} />
                    Xuất bản sao công việc
                  </button>
                )}
                <small>Không xuất mật khẩu hoặc phiên đăng nhập.</small>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>Sao Việt Long Thành · Marketing Hub</span>
            <span>Hoàn thành công việc ≠ Đã xuất bản</span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <AlertCircle size={18} />
          {toast}
          <button
            className="icon-btn"
            onClick={() => setToast("")}
            aria-label="Ẩn thông báo"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {current && (
        <TaskModal
          key={current.id}
          task={current}
          users={data.users}
          manage={manage}
          busy={busy}
          platforms={data.platforms}
          onClose={() => setSelected(null)}
          onAction={action}
          onUploaded={load}
          onOpenMedia={(folder) => {
            setSelected(null);
            setMediaJump(folder);
            setView("media");
          }}
        />
      )}
      {create && (
        <Modal title="Tạo công việc" onClose={() => setCreate(false)}>
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await action("createTask", {
                  title: f.get("title"),
                  description: f.get("description"),
                  channel: f.get("channel"),
                  assignee: f.get("assignee") || null,
                  dueDate: f.get("dueDate") || null,
                  priority: f.get("priority"),
                })
              )
                setCreate(false);
            }}
          >
            <label>
              Tên công việc
              <input
                name="title"
                minLength={3}
                maxLength={180}
                required
                autoFocus
                placeholder="Ví dụ: Chuẩn bị bài AI tuần này"
              />
            </label>
            <label>
              Mô tả
              <textarea name="description" rows={4} />
            </label>
            <div className="form-grid">
              <label>
                Kênh
                <select name="channel">
                  {channels.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Ưu tiên
                <select name="priority">
                  <option value="normal">Bình thường</option>
                  <option value="high">Cao</option>
                  <option value="low">Thấp</option>
                </select>
              </label>
              <label>
                Người phụ trách
                <select name="assignee">
                  <option value="">Chưa phân công</option>
                  {data.users
                    .filter((u) => u.active)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Ngày đến hạn
                <input type="date" name="dueDate" />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setCreate(false)}
              >
                Hủy
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "Đang lưu…" : "Tạo công việc"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {newUser && (
        <Modal title="Thêm thành viên" onClose={() => setNewUser(false)}>
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await action("createUser", {
                  name: f.get("name"),
                  email: f.get("email"),
                  role: f.get("role"),
                  password: f.get("password"),
                })
              )
                setNewUser(false);
            }}
          >
            <label>
              Họ tên
              <input name="name" minLength={2} required />
            </label>
            <label>
              Email đăng nhập
              <input name="email" type="email" required />
            </label>
            <label>
              Vai trò
              <select name="role">
                <option value="employee">Nhân viên</option>
                <option value="manager">Quản lý</option>
              </select>
            </label>
            <label>
              Mật khẩu ban đầu (tối thiểu 12 ký tự)
              <input
                type="password"
                name="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </label>
            <p className="muted">
              Bản TEST chưa gửi email mời. Hãy bàn giao thông tin đăng nhập trực
              tiếp cho thành viên.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setNewUser(false)}
              >
                Hủy
              </button>
              <button className="primary" disabled={busy}>
                Tạo tài khoản
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
function Stat({
  title,
  number,
  detail,
  icon,
  color,
}: {
  title: string;
  number: number | string;
  detail: string;
  icon: ReactNode;
  color: string;
}) {
  return (
    <section className="stat">
      <div>
        <span>{title}</span>
        <i className={color}>{icon}</i>
      </div>
      <strong>{number}</strong>
      <small>{detail}</small>
    </section>
  );
}
function TaskModal({
  task,
  users,
  manage,
  busy,
  platforms,
  onClose,
  onAction,
  onUploaded,
  onOpenMedia,
}: {
  task: Task;
  users: SafeUser[];
  manage: boolean;
  busy: boolean;
  platforms: Snapshot["platforms"];
  onClose: () => void;
  onAction: (a: string, p: unknown) => Promise<boolean>;
  onUploaded: () => Promise<void>;
  onOpenMedia: (folder: { year: number; month: number }) => void;
}) {
  const [draft, setDraft] = useState({ ...task }),
    [comment, setComment] = useState(""),
    [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState("");
  function field(k: string, v: unknown) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  async function uploadProof(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("taskId", task.id);
      form.append("file", file);
      const r = await fetch("/api/proofs", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Tải ảnh thất bại.");
      setDraft((prev) => ({
        ...prev,
        proofImage: d.proofImage,
        version: d.version,
      }));
      await onUploaded();
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  const lockedForEmployee =
    !manage &&
    (task.archived ||
      task.status === "done" ||
      task.publication === "published");
  async function save(e: FormEvent) {
    e.preventDefault();
    const patch: Record<string, unknown> = {
      status: draft.status,
      progress: draft.progress,
      publishedUrl: draft.publishedUrl,
    };
    if (manage)
      Object.assign(patch, {
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
        assignee: draft.assignee,
        dueDate: draft.dueDate,
        publication: draft.publication,
        ...(task.week ? { platform: draft.platform } : {}),
      });
    if (
      await onAction("updateTask", {
        id: task.id,
        version: draft.version,
        patch,
      })
    )
      onClose();
  }
  return (
    <Modal
      title={task.id.startsWith("DK01-") ? "DK01 · Rà việc hằng ngày" : task.id}
      onClose={onClose}
    >
      <form className="modal-body" onSubmit={save}>
        <div className="modal-task-top">
          <Channel name={task.channel} />
          <Badge status={task.status} />
          <span className="muted">{pubs[task.publication]}</span>
        </div>
        <label>
          Tên công việc
          <input
            value={draft.title}
            disabled={!manage}
            onChange={(e) => field("title", e.target.value)}
            minLength={3}
            maxLength={180}
            required
          />
        </label>
        <label>
          Mô tả
          <textarea
            rows={3}
            value={draft.description}
            disabled={!manage}
            onChange={(e) => field("description", e.target.value)}
          />
        </label>
        {task.history && (
          <div className="history-note">
            {task.history.map((s) => (
              <p key={s}>{s}</p>
            ))}
          </div>
        )}
        <div className="form-grid">
          <label>
            Người phụ trách
            <select
              value={draft.assignee || ""}
              disabled={!manage}
              onChange={(e) => field("assignee", e.target.value || null)}
            >
              <option value="">Chưa phân công</option>
              {users.map((u) => (
                <option key={u.id} value={u.id} disabled={!u.active}>
                  {u.name}
                  {!u.active ? " · Đã khóa" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ngày đến hạn
            <input
              type="date"
              disabled={!manage}
              value={draft.dueDate || ""}
              onChange={(e) => field("dueDate", e.target.value || null)}
            />
          </label>
          <label>
            Trạng thái công việc
            <select
              value={draft.status}
              onChange={(e) => field("status", e.target.value)}
            >
              {Object.entries(labels)
                .filter(
                  ([s]) =>
                    manage || ["doing", "review", draft.status].includes(s),
                )
                .map(([s, l]) => (
                  <option
                    key={s}
                    value={s}
                    disabled={!manage && !["doing", "review"].includes(s)}
                  >
                    {l}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Ưu tiên
            <select
              value={draft.priority}
              disabled={!manage}
              onChange={(e) => field("priority", e.target.value)}
            >
              <option value="high">Cao</option>
              <option value="normal">Bình thường</option>
              <option value="low">Thấp</option>
            </select>
          </label>
        </div>
        <label>
          Tiến độ sản xuất · {draft.progress}%
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={draft.progress}
            onChange={(e) => field("progress", Number(e.target.value))}
          />
        </label>
        {task.week && (
          <label>
            Nền tảng của bài social
            <select
              disabled={!manage}
              value={draft.platform}
              onChange={(e) => field("platform", e.target.value)}
            >
              {platforms.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
            <small>
              {platforms.find((p) => p.name === draft.platform)?.note ||
                "Mỗi tuần dùng ba nền tảng khác nhau."}
            </small>
          </label>
        )}
        {task.mediaFolder ? (
          <div className="publication-box">
            <h3>Thư mục Kho Ảnh &amp; Video được giao</h3>
            <p>
              Nhiệm vụ này gắn với thư mục{" "}
              <strong>
                Tháng {String(task.mediaFolder.month).padStart(2, "0")}/
                {task.mediaFolder.year}
              </strong>{" "}
              (gồm 2 thư mục con Hình ảnh và Video). Cần tải lên ít nhất 1 tệp
              vào thư mục trước khi nhân viên gửi duyệt. Admin/quản lý có thể
              giao việc và cập nhật trạng thái mà không phải tải tệp minh chứng.
            </p>
            <button
              type="button"
              className="primary"
              onClick={() => onOpenMedia(task.mediaFolder!)}
            >
              <FolderOpen size={17} /> Mở thư mục Tháng{" "}
              {String(task.mediaFolder.month).padStart(2, "0")}/
              {task.mediaFolder.year} để upload
            </button>
          </div>
        ) : (
          <div className="publication-box">
            <h3>
              {manage
                ? "Kết quả nhân viên & trạng thái xuất bản"
                : "Minh chứng hoàn thành & xuất bản"}
            </h3>
            <p>
              {manage
                ? "Admin/quản lý không cần tải ảnh hoặc nhập link để giao việc, sửa thông tin hay nghiệm thu. Minh chứng do nhân viên nộp để bạn đối chiếu. Chỉ khi chọn Đã xuất bản mới bắt buộc có URL bài thực tế."
                : "Khi gửi duyệt kết quả, nhân viên cần tải ảnh chụp màn hình công việc và nhập link bài viết (https://…). Có thể lưu tiến độ Đang làm trước khi có đủ minh chứng."}
            </p>
            <div className="form-grid">
              <label>
                {manage
                  ? "URL bài thực tế (cần khi ghi Đã xuất bản)"
                  : "Link bài viết (bắt buộc khi gửi duyệt)"}
                <input
                  type="url"
                  placeholder="https://…"
                  value={draft.publishedUrl}
                  disabled={lockedForEmployee}
                  onChange={(e) => field("publishedUrl", e.target.value)}
                  required={
                    (!manage &&
                      (draft.status === "review" || draft.status === "done")) ||
                    draft.publication === "published"
                  }
                />
              </label>
              <label>
                Trạng thái xuất bản
                <select
                  value={draft.publication}
                  disabled={!manage}
                  onChange={(e) => field("publication", e.target.value)}
                >
                  {Object.entries(pubs).map(([s, l]) => (
                    <option key={s} value={s}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ marginTop: 12 }}>
              <label>
                {manage
                  ? "Ảnh minh chứng (admin có thể bổ sung, không bắt buộc)"
                  : "Ảnh chụp màn hình minh chứng"}{" "}
                (PNG/JPG/WebP, tối đa 3,5 MB)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading || lockedForEmployee}
                  onChange={(e) => {
                    void uploadProof(e.target.files?.[0]);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              {uploading && (
                <small>Đang tải ảnh chụp màn hình lên hệ thống…</small>
              )}
              {uploadError && (
                <div className="error" role="alert" style={{ marginTop: 6 }}>
                  {uploadError}
                </div>
              )}
              {draft.proofImage?.url ? (
                <div style={{ marginTop: 10 }}>
                  <a
                    href={draft.proofImage.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "inline-block" }}
                  >
                    <img
                      src={draft.proofImage.url}
                      alt="Ảnh chụp màn hình minh chứng"
                      style={{
                        maxWidth: "100%",
                        maxHeight: 220,
                        borderRadius: 8,
                        border: "1px solid rgba(15,23,42,0.12)",
                        display: "block",
                      }}
                    />
                  </a>
                  <small style={{ display: "block", marginTop: 4 }}>
                    Đã tải lên lúc{" "}
                    {new Date(draft.proofImage.uploadedAt).toLocaleString(
                      "vi-VN",
                    )}{" "}
                    ·{" "}
                    <a
                      href={draft.proofImage.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mở ảnh đầy đủ
                    </a>
                  </small>
                </div>
              ) : (
                <small style={{ display: "block", marginTop: 6 }}>
                  Chưa có ảnh chụp màn hình minh chứng.
                </small>
              )}
            </div>
          </div>
        )}
        {task.assets && (
          <div className="asset-links">
            {task.assets.map((a) => (
              <a key={a.url} href={a.url} target="_blank" rel="noreferrer">
                <FileText size={17} />
                {a.label}
                <ExternalLink size={14} />
              </a>
            ))}
          </div>
        )}
        <div className="modal-actions">
          {manage && !task.week && (
            <button
              className="text-btn"
              type="button"
              disabled={busy}
              onClick={async () => {
                if (
                  await onAction("updateTask", {
                    id: task.id,
                    version: task.version,
                    patch: { archived: !task.archived },
                  })
                )
                  onClose();
              }}
            >
              {task.archived ? "Khôi phục khỏi thư viện" : "Lưu trữ"}
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose}>
            Đóng
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu cập nhật"}
          </button>
        </div>
      </form>
      <section className="comments">
        <h3>
          <MessageSquare size={18} />
          Trao đổi công việc
        </h3>
        {task.comments.map((c) => (
          <div className="comment" key={c.id}>
            <strong>{c.author}</strong>
            <p>{c.body}</p>
            <small>{new Date(c.at).toLocaleString("vi-VN")}</small>
          </div>
        ))}
        {!task.comments.length && (
          <p className="muted">
            Chưa có trao đổi. Để lại hướng dẫn hoặc phản hồi cho đồng đội.
          </p>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onAction("comment", { id: task.id, body: comment }))
              setComment("");
          }}
        >
          <textarea
            aria-label="Nội dung bình luận"
            placeholder="Viết phản hồi…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            required
          />
          <button className="secondary" disabled={busy || !comment.trim()}>
            <Send size={16} />
            Gửi phản hồi
          </button>
        </form>
      </section>
    </Modal>
  );
}
