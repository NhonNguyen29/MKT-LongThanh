import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { transact } from "@/lib/store";
import { currentUser } from "@/lib/service";
import { AppError, canManage, canSee } from "@/lib/permissions";
import { database, databaseUrl } from "@/lib/database";
import type { MediaItem, MediaKind } from "@/lib/types";

export const runtime = "nodejs";

const MAX_CHUNK_BYTES = 3_000_000; // 3 MB per chunk (safely below Vercel 4.5 MB limit)
const MAX_TOTAL_BYTES = 50_000_000; // 50 MB max per video/photo
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

function sanitizeName(raw: string, fallback: string) {
  const cleaned = raw
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\r\n]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      throw new AppError("Nguồn yêu cầu không hợp lệ.", 403);

    const form = await req.formData();
    const mediaId = String(form.get("mediaId") || "").trim();
    const chunkIndex = Number(form.get("chunkIndex"));
    const totalChunks = Number(form.get("totalChunks"));
    const year = Number(form.get("year"));
    const month = Number(form.get("month"));
    const kind = String(form.get("kind") || "") as MediaKind;
    const rawName = String(form.get("fileName") || "");
    const contentType = String(form.get("contentType") || "").toLowerCase();
    const sizeBytes = Number(form.get("sizeBytes"));
    const note = String(form.get("note") || "").trim().slice(0, 300);
    const taskId = String(form.get("taskId") || "").trim() || null;
    const chunk = form.get("chunk");

    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(mediaId))
      throw new AppError("Mã tệp tải lên không hợp lệ.", 400);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 25 || chunkIndex >= totalChunks)
      throw new AppError("Thông số phân mảnh tải lên không hợp lệ.", 400);
    if (!Number.isInteger(year) || year < 2020 || year > 2040 || !Number.isInteger(month) || month < 1 || month > 12)
      throw new AppError("Thư mục Năm/Tháng không hợp lệ.", 400);
    if (kind !== "images" && kind !== "videos")
      throw new AppError("Chỉ hỗ trợ thư mục Hình ảnh hoặc Video.", 400);
    if (kind === "images" && !IMAGE_TYPES.has(contentType))
      throw new AppError("Thư mục Hình ảnh chỉ nhận JPG, PNG, WebP hoặc GIF.", 400);
    if (kind === "videos" && !VIDEO_TYPES.has(contentType))
      throw new AppError("Thư mục Video chỉ nhận MP4, MOV hoặc WebM.", 400);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_TOTAL_BYTES)
      throw new AppError("Dung lượng tệp tối đa là 50 MB.", 400);
    if (!(chunk instanceof Blob) || chunk.size === 0 || chunk.size > MAX_CHUNK_BYTES)
      throw new AppError("Kích thước gói tải lên không hợp lệ.", 400);

    // Auth + permission check
    const actor = await transact((s) => {
      const user = currentUser(s, req.cookies.get("mkt_session")?.value);
      if (!canManage(user)) {
        const hasAssignedFolderTask = s.tasks.some(
          (t) =>
            canSee(user, t) &&
            t.mediaFolder &&
            t.mediaFolder.year === year &&
            t.mediaFolder.month === month,
        );
        if (!hasAssignedFolderTask)
          throw new AppError(
            "Bạn chỉ được tải tệp vào thư mục Năm/Tháng thuộc nhiệm vụ được giao trong tuần này.",
            403,
          );
      }
      if (taskId) {
        const task = s.tasks.find((t) => t.id === taskId);
        if (!task || !canSee(user, task))
          throw new AppError("Không có quyền gắn tệp vào công việc này.", 403);
      }
      return { id: user.id, name: user.name };
    });

    const buf = Buffer.from(await chunk.arrayBuffer());

    if (databaseUrl()) {
      await database().query(
        "INSERT INTO saoviet_private.mkt_media_chunks(media_id, chunk_index, body) VALUES($1,$2,$3) ON CONFLICT(media_id, chunk_index) DO UPDATE SET body=excluded.body",
        [mediaId, chunkIndex, buf],
      );
    } else {
      const dir = path.join(process.cwd(), ".local", "media", mediaId);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, String(chunkIndex)), buf);
    }

    if (chunkIndex === totalChunks - 1) {
      const safeName = sanitizeName(rawName, `${mediaId}.${kind === "images" ? "jpg" : "mp4"}`);
      const item: MediaItem = {
        id: mediaId,
        year,
        month,
        kind,
        name: safeName,
        contentType,
        sizeBytes,
        chunkCount: totalChunks,
        uploadedBy: actor.name,
        uploadedById: actor.id,
        uploadedAt: new Date().toISOString(),
        ...(note ? { note } : {}),
        ...(taskId ? { taskId } : {}),
      };
      await transact((s) => {
        s.mediaItems = s.mediaItems || [];
        s.mediaItems = [item, ...s.mediaItems.filter((x) => x.id !== mediaId)];
        s.audit.unshift({
          id: randomUUID(),
          actor: actor.name,
          message: `Tải lên ${kind === "images" ? "hình ảnh" : "video"} "${safeName}" vào Tháng ${String(month).padStart(2, "0")}/${year}`,
          at: new Date().toISOString(),
          ...(taskId ? { taskId } : {}),
        });
        s.audit = s.audit.slice(0, 1000);
      });
      return NextResponse.json({ ok: true, done: true, item });
    }

    return NextResponse.json({ ok: true, done: false, chunkIndex });
  } catch (e) {
    if (e instanceof AppError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json(
      { error: "Chưa thể tải tệp lên. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
