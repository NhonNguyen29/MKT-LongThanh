import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { transact } from "@/lib/store";
import { currentUser } from "@/lib/service";
import { AppError, canManage, canSee } from "@/lib/permissions";
import { database, databaseUrl } from "@/lib/database";

export const runtime = "nodejs";

const MAX_BYTES = 3_500_000;

function detectImage(buf: Buffer): { ext: string; mime: string } | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
    return { ext: "png", mime: "image/png" };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { ext: "jpg", mime: "image/jpeg" };
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return { ext: "webp", mime: "image/webp" };
  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      throw new AppError("Nguồn yêu cầu không hợp lệ.", 403);
    const form = await req.formData();
    const taskId = String(form.get("taskId") || "").trim();
    const file = form.get("file");
    if (!taskId || !(file instanceof File))
      throw new AppError("Thiếu mã công việc hoặc tệp ảnh chụp màn hình.", 400);
    if (file.size === 0 || file.size > MAX_BYTES)
      throw new AppError("Ảnh chụp màn hình phải nhỏ hơn 3,5 MB.", 400);
    const buf = Buffer.from(await file.arrayBuffer());
    const detected = detectImage(buf);
    if (!detected)
      throw new AppError(
        "Chỉ hỗ trợ ảnh chụp màn hình định dạng PNG, JPG hoặc WebP.",
        400,
      );

    const safeTask = taskId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "task";
    const assetName = `proof-${safeTask}-${randomUUID().slice(0, 8)}.${detected.ext}`;
    const assetUrl = `/api/assets/${assetName}`;
    const sha256 = createHash("sha256").update(buf).digest("hex");

    // Verify user & task access before storing binary
    await transact((s) => {
      const user = currentUser(s, req.cookies.get("mkt_session")?.value);
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task || !canSee(user, task))
        throw new AppError("Không tìm thấy công việc được phép truy cập.", 404);
      if (
        !canManage(user) &&
        (task.archived || task.status === "done" || task.publication === "published")
      )
        throw new AppError(
          "Công việc đã nghiệm thu. Liên hệ quản lý để mở lại.",
          403,
        );
    });

    if (databaseUrl()) {
      await database().query(
        "INSERT INTO saoviet_private.mkt_assets(name,content_type,body,sha256) VALUES($1,$2,$3,$4)",
        [assetName, detected.mime, buf, sha256],
      );
    } else {
      const dir = path.join(process.cwd(), ".local", "assets");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, assetName), buf);
    }

    const updated = await transact((s) => {
      const user = currentUser(s, req.cookies.get("mkt_session")?.value);
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task || !canSee(user, task))
        throw new AppError("Không tìm thấy công việc được phép truy cập.", 404);
      const proofImage = {
        url: assetUrl,
        name: assetName,
        uploadedAt: new Date().toISOString(),
      };
      task.proofImage = proofImage;
      task.updatedAt = new Date().toISOString();
      task.version++;
      s.audit.unshift({
        id: randomUUID(),
        actor: user.name,
        message: "Tải lên ảnh chụp minh chứng cho " + task.id,
        at: new Date().toISOString(),
        taskId: task.id,
      });
      s.audit = s.audit.slice(0, 1000);
      return { ok: true, proofImage, version: task.version };
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof AppError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json(
      { error: "Chưa thể tải ảnh lên. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
