"use client";
import { useState, type FormEvent } from "react";
import { zipSync } from "fflate";
import {
  FolderOpen,
  Image as ImageIcon,
  Film,
  Upload,
  Download,
  Trash2,
  CalendarDays,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  UserCheck,
} from "lucide-react";
import type { MediaItem, MediaKind, SafeUser, Task } from "@/lib/types";

const CHUNK_SIZE = 2_400_000; // 2.4 MB per chunk (< Vercel 4.5 MB limit)

function fmtSize(bytes: number) {
  if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + " MB";
  return Math.max(1, Math.round(bytes / 1000)) + " KB";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function makeMediaId() {
  const arr = new Uint8Array(9);
  crypto.getRandomValues(arr);
  return (
    "md_" +
    Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")
  );
}

export function MediaVault({
  items,
  tasks,
  users,
  currentUserId,
  manage,
  busy,
  initialFolder,
  onReload,
  onAction,
  onOpenTask,
}: {
  items: MediaItem[];
  tasks: Task[];
  users: SafeUser[];
  currentUserId: string;
  manage: boolean;
  busy: boolean;
  initialFolder?: { year: number; month: number } | null;
  onReload: () => Promise<void>;
  onAction: (action: string, payload: unknown) => Promise<boolean>;
  onOpenTask: (taskId: string) => void;
}) {
  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth() + 1;

  const existingYears = Array.from(
    new Set([
      2025,
      2026,
      2027,
      nowYear,
      ...items.map((i) => i.year),
      ...tasks.filter((t) => t.mediaFolder).map((t) => t.mediaFolder!.year),
    ]),
  ).sort((a, b) => b - a);

  const [extraYears, setExtraYears] = useState<number[]>([]);
  const [year, setYear] = useState<number>(initialFolder?.year ?? 2026);
  const [month, setMonth] = useState<number>(initialFolder?.month ?? nowMonth);
  const [kind, setKind] = useState<MediaKind>("images");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [zipping, setZipping] = useState(false);
  const [zipStatus, setZipStatus] = useState("");
  const [error, setError] = useState("");
  const [showAssign, setShowAssign] = useState(false);

  const years = Array.from(new Set([...existingYears, ...extraYears])).sort(
    (a, b) => b - a,
  );

  const yearItems = items.filter((i) => i.year === year);
  const monthItems = yearItems.filter((i) => i.month === month);
  const folderItems = monthItems.filter((i) => i.kind === kind);
  const monthTasks = tasks.filter(
    (t) =>
      t.mediaFolder &&
      t.mediaFolder.year === year &&
      t.mediaFolder.month === month,
  );

  const canUploadHere =
    manage || monthTasks.some((t) => t.assignee === currentUserId);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    setUploading(true);
    setError("");
    const files = Array.from(fileList);
    const activeTaskId =
      monthTasks.find((t) => t.assignee === currentUserId)?.id ||
      monthTasks[0]?.id ||
      "";
    try {
      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        if (file.size > 50_000_000) {
          throw new Error(`Tệp "${file.name}" vượt quá giới hạn 50 MB.`);
        }
        const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
        const mediaId = makeMediaId();
        for (let c = 0; c < totalChunks; c++) {
          const pct = Math.round(((c + 1) / totalChunks) * 100);
          setUploadStatus(
            `Đang tải tệp ${fIdx + 1}/${files.length}: ${file.name} (${pct}%)…`,
          );
          const slice = file.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
          const fd = new FormData();
          fd.append("mediaId", mediaId);
          fd.append("chunkIndex", String(c));
          fd.append("totalChunks", String(totalChunks));
          fd.append("year", String(year));
          fd.append("month", String(month));
          fd.append("kind", kind);
          fd.append("fileName", file.name);
          fd.append(
            "contentType",
            file.type || (kind === "images" ? "image/jpeg" : "video/mp4"),
          );
          fd.append("sizeBytes", String(file.size));
          if (activeTaskId) fd.append("taskId", activeTaskId);
          fd.append("chunk", slice, file.name);

          const res = await fetch("/api/media/chunk", {
            method: "POST",
            body: fd,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Tải tệp thất bại.");
        }
      }
      setUploadStatus(`Đã tải lên thành công ${files.length} tệp.`);
      await onReload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function downloadZip(
    scopeItems: MediaItem[],
    zipName: string,
    includeYear: boolean,
    includeMonth: boolean,
  ) {
    if (!scopeItems.length) {
      setError("Thư mục đang trống, chưa có tệp để tải về.");
      return;
    }
    setZipping(true);
    setError("");
    try {
      const filesMap: Record<string, Uint8Array> = {};
      const usedPaths = new Set<string>();

      for (let i = 0; i < scopeItems.length; i++) {
        const it = scopeItems[i];
        setZipStatus(`Đang gom tệp ${i + 1}/${scopeItems.length}: ${it.name}…`);
        const r = await fetch(`/api/media/file?id=${encodeURIComponent(it.id)}`);
        if (!r.ok) throw new Error(`Không thể tải tệp "${it.name}".`);
        const bytes = new Uint8Array(await r.arrayBuffer());
        const subFolder = it.kind === "images" ? "Hinh-anh" : "Video";
        const segments: string[] = [];
        if (includeYear) segments.push(String(it.year));
        if (includeMonth) segments.push(`Thang-${pad2(it.month)}`);
        segments.push(subFolder);
        let entryPath = `${segments.join("/")}/${it.name}`;
        let dup = 1;
        while (usedPaths.has(entryPath)) {
          entryPath = `${segments.join("/")}/${dup++}-${it.name}`;
        }
        usedPaths.add(entryPath);
        filesMap[entryPath] = bytes;
      }

      setZipStatus("Đang đóng gói tệp ZIP…");
      const zipped = zipSync(filesMap, { level: 0 }); // store mode: fast & lossless for JPG/MP4
      const blob = new Blob([zipped as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setZipStatus(`Đã tải xong ${zipName} (${scopeItems.length} tệp).`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setZipping(false);
    }
  }

  async function deleteItem(item: MediaItem) {
    if (!confirm(`Xóa "${item.name}" khỏi Tháng ${pad2(item.month)}/${item.year}?`))
      return;
    setError("");
    const r = await fetch(`/api/media/file?id=${encodeURIComponent(item.id)}`, {
      method: "DELETE",
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(d.error || "Không thể xóa tệp.");
      return;
    }
    await onReload();
  }

  async function submitAssign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await onAction("createTask", {
      title: String(f.get("title") || "").trim(),
      description: String(f.get("description") || "").trim(),
      channel: "Kho Media",
      assignee: String(f.get("assignee") || "") || null,
      dueDate: String(f.get("dueDate") || "") || null,
      priority: String(f.get("priority") || "high"),
      mediaFolder: { year, month },
    });
    if (ok) setShowAssign(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Top Year Bar + Folder ZIP Actions */}
      <section className="panel" style={{ padding: 20 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <FolderOpen size={22} /> Kho Hình Ảnh &amp; Video theo Năm / Tháng
            </h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Cấu trúc: <strong>Năm {year}</strong> → <strong>Tháng {pad2(month)}</strong> →{" "}
              <strong>{kind === "images" ? "Hình ảnh" : "Video"}</strong>
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {manage && (
              <button
                className="primary"
                type="button"
                onClick={() => setShowAssign((v) => !v)}
              >
                <UserCheck size={17} /> Giao việc upload &amp; deadline
              </button>
            )}
            <button
              className="secondary"
              type="button"
              disabled={zipping || !yearItems.length}
              onClick={() =>
                downloadZip(
                  yearItems,
                  `SaoViet-Media-${year}.zip`,
                  true,
                  true,
                )
              }
            >
              <Download size={16} /> Tải cả năm {year} ({yearItems.length})
            </button>
            <button
              className="secondary"
              type="button"
              disabled={zipping || !monthItems.length}
              onClick={() =>
                downloadZip(
                  monthItems,
                  `SaoViet-Media-${year}-Thang-${pad2(month)}.zip`,
                  false,
                  true,
                )
              }
            >
              <Download size={16} /> Tải Tháng {pad2(month)} ({monthItems.length})
            </button>
          </div>
        </div>

        {/* Year selector pills */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 14,
            alignItems: "center",
          }}
        >
          <span className="muted" style={{ fontWeight: 700, fontSize: 13 }}>
            NĂM:
          </span>
          {years.map((y) => {
            const cnt = items.filter((i) => i.year === y).length;
            return (
              <button
                key={y}
                type="button"
                className={y === year ? "primary" : "secondary"}
                onClick={() => setYear(y)}
                style={{ padding: "6px 14px" }}
              >
                {y} ({cnt})
              </button>
            );
          })}
          {manage && (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                const raw = prompt("Nhập năm muốn thêm (ví dụ 2028):");
                const num = Number(raw);
                if (Number.isInteger(num) && num >= 2020 && num <= 2040) {
                  setExtraYears((prev) => [...prev, num]);
                  setYear(num);
                }
              }}
            >
              <Plus size={15} /> Thêm năm
            </button>
          )}
        </div>

        {/* 12 Months Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 10,
            marginTop: 14,
          }}
        >
          {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => {
            const imgs = yearItems.filter(
              (i) => i.month === m && i.kind === "images",
            ).length;
            const vids = yearItems.filter(
              (i) => i.month === m && i.kind === "videos",
            ).length;
            const hasTask = tasks.some(
              (t) => t.mediaFolder?.year === year && t.mediaFolder?.month === m,
            );
            const selected = m === month;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMonth(m)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: selected
                    ? "2px solid #2563EB"
                    : "1px solid rgba(15,23,42,0.12)",
                  background: selected ? "#EFF6FF" : "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontWeight: 800,
                    fontSize: 14,
                    color: selected ? "#1D4ED8" : "#111827",
                  }}
                >
                  <span>Tháng {pad2(m)}</span>
                  {hasTask && <Clock size={14} color="#D97706" />}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#64748B",
                    marginTop: 4,
                  }}
                >
                  🖼️ {imgs} · 🎬 {vids}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Assign Media Upload Task Form (Owner/Manager) */}
      {manage && showAssign && (
        <section className="panel" style={{ padding: 20, border: "2px solid #2563EB" }}>
          <h3 style={{ marginTop: 0 }}>
            Giao nhiệm vụ upload cho Tháng {pad2(month)}/{year}
          </h3>
          <form onSubmit={submitAssign} className="modal-body" style={{ padding: 0 }}>
            <label>
              Tên nhiệm vụ
              <input
                name="title"
                required
                defaultValue={`Upload hình ảnh đẹp & video lớp học Tháng ${pad2(month)}/${year}`}
              />
            </label>
            <label>
              Yêu cầu chi tiết
              <textarea
                name="description"
                rows={2}
                defaultValue={`Chọn lọc hình ảnh sắc nét và video lớp học thực tế, tải lên đúng thư mục Hình ảnh và Video của Tháng ${pad2(month)}/${year}.`}
              />
            </label>
            <div className="form-grid">
              <label>
                Phân công nhân viên
                <select name="assignee" required>
                  <option value="">— Chọn nhân sự —</option>
                  {users
                    .filter((u) => u.active)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Deadline hoàn thành
                <input type="date" name="dueDate" required />
              </label>
              <label>
                Ưu tiên
                <select name="priority" defaultValue="high">
                  <option value="high">Cao</option>
                  <option value="normal">Bình thường</option>
                  <option value="low">Thấp</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setShowAssign(false)}
              >
                Đóng
              </button>
              <button className="primary" disabled={busy}>
                Tạo &amp; giao nhiệm vụ
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Linked Tasks for This Month */}
      {monthTasks.length > 0 && (
        <section className="panel" style={{ padding: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <CalendarDays size={17} /> Nhiệm vụ upload của Tháng {pad2(month)}/{year}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {monthTasks.map((t) => {
              const assignee = users.find((u) => u.id === t.assignee)?.name || "Chưa phân công";
              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "#F8FAFC",
                    border: "1px solid rgba(15,23,42,0.1)",
                  }}
                >
                  <div>
                    <strong>{t.title}</strong>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Phụ trách: {assignee} · Hạn: {t.dueDate || "Chưa đặt"} · Trạng thái:{" "}
                      <strong>{t.status}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onOpenTask(t.id)}
                  >
                    Mở công việc / Gửi duyệt
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Subfolder Switcher (Hinh-anh / Video) + Upload + Gallery */}
      <section className="panel" style={{ padding: 20 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={kind === "images" ? "primary" : "secondary"}
              onClick={() => setKind("images")}
            >
              <ImageIcon size={17} /> Thư mục Hình ảnh (
              {monthItems.filter((i) => i.kind === "images").length})
            </button>
            <button
              type="button"
              className={kind === "videos" ? "primary" : "secondary"}
              onClick={() => setKind("videos")}
            >
              <Film size={17} /> Thư mục Video (
              {monthItems.filter((i) => i.kind === "videos").length})
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className="secondary"
              disabled={zipping || !folderItems.length}
              onClick={() =>
                downloadZip(
                  folderItems,
                  `SaoViet-${year}-Thang-${pad2(month)}-${kind === "images" ? "Hinh-anh" : "Video"}.zip`,
                  false,
                  false,
                )
              }
            >
              <Download size={16} /> Tải thư mục này (.ZIP)
            </button>

            {canUploadHere && (
              <label
                className="primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  borderRadius: 12,
                  cursor: uploading ? "wait" : "pointer",
                  fontWeight: 700,
                }}
              >
                <Upload size={17} />
                {uploading
                  ? "Đang tải lên…"
                  : kind === "images"
                    ? "Upload Hình ảnh"
                    : "Upload Video"}
                <input
                  type="file"
                  multiple
                  disabled={uploading}
                  accept={
                    kind === "images"
                      ? "image/jpeg,image/png,image/webp,image/gif"
                      : "video/mp4,video/quicktime,video/webm"
                  }
                  style={{ display: "none" }}
                  onChange={(e) => {
                    void uploadFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {!canUploadHere && (
          <p className="muted" style={{ marginBottom: 12 }}>
            Bạn chỉ có thể upload tệp vào các tháng được phân công nhiệm vụ trong tuần này.
          </p>
        )}

        {(uploadStatus || zipStatus) && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#ECFDF5",
              color: "#065F46",
              fontWeight: 700,
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle2 size={17} />
            {uploading ? uploadStatus : zipping ? zipStatus : uploadStatus || zipStatus}
          </div>
        )}

        {error && (
          <div className="error" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        {folderItems.length === 0 ? (
          <div
            style={{
              padding: "42px 20px",
              textAlign: "center",
              borderRadius: 16,
              border: "2px dashed rgba(15,23,42,0.16)",
              color: "#64748B",
            }}
          >
            Chưa có {kind === "images" ? "hình ảnh" : "video"} nào trong{" "}
            <strong>
              {year} / Tháng {pad2(month)} / {kind === "images" ? "Hình ảnh" : "Video"}
            </strong>
            .
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            {folderItems.map((it) => {
              const fileUrl = `/api/media/file?id=${encodeURIComponent(it.id)}`;
              return (
                <div
                  key={it.id}
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "#FFF",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      height: 170,
                      background: "#0F172A",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {it.kind === "images" ? (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ width: "100%", height: "100%", display: "block" }}
                      >
                        <img
                          src={fileUrl}
                          alt={it.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </a>
                    ) : (
                      <video
                        src={fileUrl}
                        controls
                        preload="metadata"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    )}
                  </div>
                  <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div
                      title={it.name}
                      style={{
                        fontWeight: 800,
                        fontSize: 13,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {it.name}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {fmtSize(it.sizeBytes)} · {it.uploadedBy}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <a
                        href={fileUrl}
                        download={it.name}
                        className="text-btn"
                        style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <ExternalLink size={13} /> Tải tệp
                      </a>
                      {(manage || it.uploadedById === currentUserId) && (
                        <button
                          type="button"
                          className="text-btn"
                          style={{ color: "#DC2626", fontSize: 12 }}
                          onClick={() => deleteItem(it)}
                        >
                          <Trash2 size={13} /> Xóa
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
