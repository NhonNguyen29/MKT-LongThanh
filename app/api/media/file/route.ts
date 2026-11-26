import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { transact } from "@/lib/store";
import { currentUser } from "@/lib/service";
import { AppError, canManage, canSee } from "@/lib/permissions";
import { database, databaseUrl } from "@/lib/database";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const id = String(req.nextUrl.searchParams.get("id") || "").trim();
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id))
      throw new AppError("Không tìm thấy tệp.", 404);

    const item = await transact((s) => {
      const user = currentUser(s, req.cookies.get("mkt_session")?.value);
      const found = (s.mediaItems || []).find((m) => m.id === id);
      if (!found) throw new AppError("Không tìm thấy tệp.", 404);
      if (!canManage(user) && found.uploadedById !== user.id) {
        const hasTask = s.tasks.some(
          (t) =>
            canSee(user, t) &&
            t.mediaFolder &&
            t.mediaFolder.year === found.year &&
            t.mediaFolder.month === found.month,
        );
        if (!hasTask) throw new AppError("Không có quyền xem tệp này.", 403);
      }
      return found;
    });

    const parts: Buffer[] = [];
    if (databaseUrl()) {
      const res = await database().query(
        "SELECT body FROM saoviet_private.mkt_media_chunks WHERE media_id=$1 ORDER BY chunk_index ASC",
        [id],
      );
      for (const r of res.rows) parts.push(r.body);
    } else {
      for (let i = 0; i < item.chunkCount; i++) {
        parts.push(
          await readFile(path.join(process.cwd(), ".local", "media", id, String(i))),
        );
      }
    }
    if (!parts.length)
      throw new AppError("Không tìm thấy dữ liệu tệp trong kho.", 404);

    const full = Buffer.concat(parts);
    const safeDisp = encodeURIComponent(item.name);
    return new NextResponse(full, {
      headers: {
        "Content-Type": item.contentType,
        "Content-Length": String(full.length),
        "Content-Disposition": `inline; filename*=UTF-8''${safeDisp}`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof AppError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json(
      { error: "Không thể tải tệp. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      throw new AppError("Nguồn yêu cầu không hợp lệ.", 403);
    const id = String(req.nextUrl.searchParams.get("id") || "").trim();
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id))
      throw new AppError("Không tìm thấy tệp.", 404);

    await transact((s) => {
      const user = currentUser(s, req.cookies.get("mkt_session")?.value);
      const found = (s.mediaItems || []).find((m) => m.id === id);
      if (!found) throw new AppError("Không tìm thấy tệp.", 404);
      if (!canManage(user) && found.uploadedById !== user.id)
        throw new AppError("Bạn không có quyền xóa tệp này.", 403);
      s.mediaItems = (s.mediaItems || []).filter((m) => m.id !== id);
      s.audit.unshift({
        id: randomUUID(),
        actor: user.name,
        message: `Xóa tệp "${found.name}" khỏi Tháng ${String(found.month).padStart(2, "0")}/${found.year}`,
        at: new Date().toISOString(),
      });
      s.audit = s.audit.slice(0, 1000);
    });

    if (databaseUrl()) {
      await database().query(
        "DELETE FROM saoviet_private.mkt_media_chunks WHERE media_id=$1",
        [id],
      );
    } else {
      await rm(path.join(process.cwd(), ".local", "media", id), {
        recursive: true,
        force: true,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AppError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json(
      { error: "Chưa thể xóa tệp." },
      { status: 500 },
    );
  }
}
