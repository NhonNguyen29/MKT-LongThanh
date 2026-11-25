import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { transact } from "@/lib/store";
import { currentUser } from "@/lib/service";
import { canSee, AppError } from "@/lib/permissions";
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
    const data = await readFile(
      path.join(process.cwd(), ".local", "assets", name),
    );
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
            : "Tệp chỉ có ở bản local; cần chuyển kho tài liệu khi triển khai.",
      },
      { status: e instanceof AppError ? e.status : 404 },
    );
  }
}
