import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { transact } from "@/lib/store";
import { currentUser } from "@/lib/service";
import { canSee, AppError } from "@/lib/permissions";
import { database, databaseUrl } from "@/lib/database";
export const runtime = "nodejs";
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await ctx.params;
    if (
      !/^(01-ai-cong-viec|02-seo-quang-cao|03-tin-hoc-van-phong)\.(png|md)$/.test(
        name,
      )
    )
      throw new AppError("Không tìm thấy tệp.", 404);
    await transact((s) => {
      const user = currentUser(s, req.cookies.get("mkt_session")?.value);
      const task = s.tasks.find((t) =>
        t.assets?.some((a) => a.url === "/api/assets/" + name),
      );
      if (!task || !canSee(user, task))
        throw new AppError("Không có quyền xem tệp.", 403);
    });
    const data = databaseUrl()
      ? (
          await database().query(
            "SELECT body FROM saoviet_private.mkt_assets WHERE name=$1",
            [name],
          )
        ).rows[0]?.body
      : await readFile(path.join(process.cwd(), ".local", "assets", name));
    if (!data)
      throw new AppError("Không tìm thấy tệp trong kho tài liệu.", 404);
    return new NextResponse(data, {
      headers: {
        "Content-Type": name.endsWith(".png")
          ? "image/png"
          : "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "Chưa thể mở tệp. Vui lòng thử lại hoặc liên hệ quản lý.",
      },
      { status: e instanceof AppError ? e.status : 404 },
    );
  }
}
