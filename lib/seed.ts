import type { State, Task, User } from "./types";
import { hashPassword, randomToken } from "./security";
import { vietnamDate, weekStart, weeklyRotation } from "./calendar";
const stamp = "2026-11-25T03:00:00.000Z";
function task(
  id: string,
  title: string,
  channel: string,
  status: Task["status"],
  description: string,
  extra: Partial<Task> = {},
): Task {
  return {
    id,
    title,
    channel,
    status,
    description,
    priority: "normal",
    publication: "draft",
    assignee: null,
    dueDate: null,
    progress: status === "done" ? 100 : status === "review" ? 90 : 0,
    publishedUrl: "",
    publishedAt: null,
    updatedAt: stamp,
    version: 1,
    archived: false,
    comments: [],
    ...extra,
  };
}
export function seedTasks(): Task[] {
  return [
    task(
      "ND01",
      "Mẫu tổng hợp khai giảng tháng 12",
      "Facebook",
      "done",
      "Mẫu đã được duyệt ngày 25/11. Chỉ thông báo tháng 12/2026, chưa chốt ngày và ca học.",
      { publication: "approved" },
    ),
    ...[
      ["ND02", "AI vào công việc", "01-ai-cong-viec"],
      ["ND03", "SEO & Quảng cáo đa nền tảng", "02-seo-quang-cao"],
      ["ND04", "Tin học văn phòng cho người mới", "03-tin-hoc-van-phong"],
    ].map(([id, title, file]) =>
      task(
        id,
        "Ảnh & bài tháng 12 · " + title,
        "Facebook",
        "done",
        "Đã bàn giao ảnh có logo thật, ảnh lớp học và caption riêng. Chưa xuất bản. Lịch khai giảng mới xác nhận tháng 12/2026.",
        {
          publication: "delivered",
          assets: [
            { label: "Ảnh đã thiết kế", url: "/api/assets/" + file + ".png" },
            {
              label: "Bài đăng để sao chép",
              url: "/api/assets/" + file + ".md",
            },
          ],
        },
      ),
    ),
    ...[
      ["ND05", "AI vào công việc"],
      ["ND06", "SEO & Quảng cáo"],
      ["ND07", "THVP người mới"],
    ].map(([id, title]) =>
      task(
        id,
        "Bài Google Maps · " + title,
        "Google Maps",
        "done",
        "Đã soạn tiêu đề và mô tả trong hội thoại. Đề xuất loại Cập nhật vì chưa có ngày/ca hoặc ưu đãi được chốt. Chưa nhập biểu mẫu, chưa đăng.",
        { publication: "delivered" },
      ),
    ),
    task(
      "ND08",
      "Rà liên hệ & triển khai bộ 4 bài ngày 26/11",
      "Facebook",
      "todo",
      "Đã có 4 caption và ảnh. Rà địa chỉ/hotline Long Thành hiện hành trước khi dùng. Ngày 26/11 là mốc dự kiến trong hồ sơ.",
      {
        dueDate: "2026-11-26",
        priority: "high",
        progress: 65,
        publication: "delivered",
      },
    ),
    task(
      "ND09",
      "Đối chiếu bộ 4 bài ngày 19/11",
      "Facebook",
      "todo",
      "Caption còn thông tin liên hệ cũ. Cần xác nhận đã đăng ngoài hệ thống hay chưa; chưa có URL chứng minh.",
      { priority: "high", progress: 65, publication: "delivered" },
    ),
    task(
      "ND10",
      "Xác minh bộ 4 bài ngày 12/11",
      "Facebook",
      "todo",
      "Có nội dung và ảnh. Chưa xác minh trạng thái xuất bản sau ngày dự kiến.",
      { progress: 65, publication: "delivered" },
    ),
    task(
      "ND11",
      "Rà bài SEO Long Thành · ảnh 02 ngày 13/11",
      "Google Maps",
      "todo",
      "Đã soạn ảnh và bài. Kiểm tra lại thông tin liên hệ trước khi dùng.",
      { progress: 65, publication: "delivered" },
    ),
    task(
      "ND12",
      "Rà bài SEO kèm ưu đãi ngày 13/11",
      "Google Maps",
      "todo",
      "Cần xác minh hiệu lực ưu đãi và thông tin liên hệ trước khi dùng. Không tự thêm mức giảm hoặc gia hạn ưu đãi.",
      { priority: "low", progress: 50 },
    ),
    task(
      "VD01",
      "AutoCAD LINE · animation tượng trưng",
      "TikTok",
      "review",
      "Bản 37,7 giây đã bàn giao, đang chờ duyệt. Giọng Quang Minh, nhập chiều dài chính xác. Chưa xuất bản.",
      {
        publication: "delivered",
        history: [
          "VD05 đã gộp theo xác nhận của người dùng: biến thể animation 35,4 giây được giữ trong lịch sử, không còn là đầu việc riêng.",
        ],
      },
    ),
    task(
      "VD02",
      "AutoCAD CIRCLE · nhập bán kính",
      "TikTok",
      "review",
      "Video 33,9 giây, giọng Quang Minh. Đã bàn giao, chờ duyệt; chưa xuất bản.",
      { publication: "delivered" },
    ),
    task(
      "VD03",
      "Excel · tính tổng bằng Alt + =",
      "TikTok",
      "review",
      "Video 33,6 giây, giọng Quang Minh. Đã bàn giao, chờ duyệt; chưa xuất bản.",
      { publication: "delivered" },
    ),
    task(
      "VD04",
      "Photoshop · Layer Mask",
      "TikTok",
      "review",
      "Video 33,4 giây, thao tác không phá hủy ảnh. Đã bàn giao, chờ duyệt; chưa xuất bản.",
      { publication: "delivered" },
    ),
    task(
      "DK03",
      "Tổng kết cuối ngày khi được yêu cầu",
      "Vận hành",
      "todo",
      "Báo cáo đã làm, chưa xong, đang chờ duyệt và bài đã đăng. Chưa thống nhất chuyển thành nhiệm vụ bắt buộc hằng ngày.",
      { priority: "low" },
    ),
    task(
      "TV01",
      "Mẫu AI văn phòng · Editorial Style 1",
      "Thư viện",
      "done",
      "Đã duyệt thiết kế chủ lực. Chưa xác minh xuất bản.",
      { publication: "approved", archived: true },
    ),
    task(
      "TV02",
      "Mẫu AutoCAD · màu & hiệu ứng nút",
      "Thư viện",
      "done",
      "Đã duyệt mẫu; giữ để tham chiếu, không tự dựng lại.",
      { publication: "approved", archived: true },
    ),
    task(
      "TV03",
      "Mẫu Excel v3 · lời chào & logo trắng",
      "Thư viện",
      "done",
      "Đã duyệt mẫu ngày 18/11. Trạng thái xuất bản chưa được xác minh.",
      { publication: "approved", archived: true },
    ),
    task(
      "TV04",
      "Bộ 3 video người mới · 18/11",
      "Thư viện",
      "done",
      "Excel, AutoCAD, Photoshop. Đã sản xuất và bàn giao; chưa xuất bản.",
      { publication: "delivered", archived: true },
    ),
    task(
      "TV05",
      "Bộ công cụ Video Studio",
      "Thư viện",
      "done",
      "Đã cài đặt và kiểm tra Remotion, GSAP, Manim, Blender MCP, FFmpeg.",
      { archived: true },
    ),
  ];
}
export function ensureRecurring(state: State, now = new Date()) {
  const today = vietnamDate(now),
    week = weekStart(today);
  const dailyId = "DK01-" + today;
  if (!state.tasks.some((t) => t.id === dailyId))
    state.tasks.push(
      task(
        dailyId,
        "Rà việc hôm nay & mẫu chờ duyệt",
        "Vận hành",
        "todo",
        "Mở bảng điều hành, rà việc đến hạn, còn dang dở và cần phê duyệt. Nhắc lúc " +
          state.settings.reminderTime +
          " theo giờ Việt Nam.",
        { dueDate: today, updatedAt: now.toISOString() },
      ),
    );
  for (const t of state.tasks)
    if (t.id.startsWith("DK01-") && t.dueDate !== today && t.status === "done")
      t.archived = true;
  weeklyRotation(week).forEach((platform, i) => {
    const id = "SOC-" + week + "-" + (i + 1);
    if (!state.tasks.some((t) => t.id === id))
      state.tasks.push(
        task(
          id,
          "Bài social tuần · " + platform,
          "Social",
          "todo",
          "Chỉ tiêu tổng 3 bài trên 3 nền tảng khác nhau trong tuần. Chọn nội dung, gửi duyệt trước đăng, lưu URL để xác minh. Nền tảng gợi ý có thể đổi nhưng không trùng hai bài còn lại.",
          { week, platform, updatedAt: now.toISOString() },
        ),
      );
  });
}
export function initialState(): State {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12)
    throw new Error(
      "Cần ADMIN_PASSWORD tối thiểu 12 ký tự. Chạy npm run setup:local cho bản TEST.",
    );
  const owner: User = {
    id: "owner",
    name: process.env.ADMIN_NAME || "Chủ trung tâm",
    email: (process.env.ADMIN_EMAIL || "admin@saoviet.local").toLowerCase(),
    role: "owner",
    active: true,
    passwordHash: hashPassword(password),
  };
  const users = [owner];
  if (
    process.env.LOCAL_TEST_LOGIN === "true" &&
    !process.env.VERCEL &&
    process.env.NODE_ENV !== "production"
  )
    for (const [id, name, role] of [
      ["test-manager", "Quản lý · TEST", "manager"],
      ["test-employee", "Nhân viên · TEST", "employee"],
    ] as const)
      users.push({
        id,
        name,
        role,
        email: id + "@saoviet.local",
        active: true,
        passwordHash: hashPassword(randomToken()),
      });
  const state: State = {
    schemaVersion: 1,
    users,
    tasks: seedTasks(),
    sessions: [],
    attempts: {},
    audit: [
      {
        id: "initial",
        actor: "Hệ thống",
        message:
          "Nhập danh sách đã xác thực. Gộp VD05 vào VD01; chốt 3 bài/tuần trên 3 nền tảng khác nhau.",
        at: stamp,
      },
    ],
    readNotifications: {},
    settings: { reminderTime: "10:00", timezone: "Asia/Ho_Chi_Minh" },
  };
  ensureRecurring(state);
  return state;
}
