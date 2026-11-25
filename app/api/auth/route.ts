import { NextRequest, NextResponse } from "next/server";
import { transact } from "@/lib/store";
import { AppError } from "@/lib/permissions";
import { randomToken, tokenHash, verifyPassword } from "@/lib/security";
export const runtime = "nodejs";
function localAllowed(req: NextRequest) {
  return (
    !process.env.VERCEL &&
    process.env.NODE_ENV !== "production" &&
    process.env.LOCAL_TEST_LOGIN === "true" &&
    ["localhost", "127.0.0.1"].includes(req.nextUrl.hostname)
  );
}
export async function GET(req: NextRequest) {
  return NextResponse.json({ localTest: localAllowed(req) });
}
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      return NextResponse.json(
        { error: "Nguồn yêu cầu không hợp lệ." },
        { status: 403 },
      );
    const body = await req.json();
    const result = await transact((state) => {
      state.sessions = state.sessions.filter((s) => s.expires > Date.now());
      let user;
      if (body.testRole) {
        if (!localAllowed(req))
          return {
            error:
              "Đăng nhập TEST chỉ dùng tại máy local trong chế độ development.",
            status: 403,
          };
        const ids: Record<string, string> = {
          owner: "owner",
          manager: "test-manager",
          employee: "test-employee",
        };
        user = state.users.find((u) => u.id === ids[body.testRole] && u.active);
      } else {
        if (
          typeof body.email !== "string" ||
          typeof body.password !== "string" ||
          body.email.length > 150 ||
          body.password.length > 128
        )
          return { error: "Thông tin đăng nhập không hợp lệ.", status: 400 };
        const email = body.email.toLowerCase().trim();
        const key = tokenHash(email);
        const attempt = state.attempts[key];
        if (attempt && attempt.until > Date.now() && attempt.count >= 8)
          return {
            error: "Thử lại sau 15 phút vì có quá nhiều lần đăng nhập sai.",
            status: 429,
          };
        user = state.users.find((u) => u.email === email && u.active);
        if (!user || !verifyPassword(body.password, user.passwordHash)) {
          state.attempts[key] = {
            count:
              attempt && attempt.until > Date.now() ? attempt.count + 1 : 1,
            until: Date.now() + 15 * 60000,
          };
          return { error: "Email hoặc mật khẩu chưa đúng.", status: 401 };
        }
        delete state.attempts[key];
      }
      if (!user)
        return {
          error: "Tài khoản TEST chưa có. Kiểm tra cấu hình local.",
          status: 401,
        };
      const token = randomToken();
      state.sessions.push({
        hash: tokenHash(token),
        userId: user.id,
        expires: Date.now() + 8 * 3600000,
      });
      return { token };
    });
    if (result.error)
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    const res = NextResponse.json({ ok: true });
    res.cookies.set("mkt_session", result.token!, {
      httpOnly: true,
      secure: !!process.env.VERCEL || req.nextUrl.protocol === "https:",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 3600,
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "Chưa thể mở dữ liệu. Kiểm tra cấu hình máy chủ.",
      },
      { status: 503 },
    );
  }
}
export async function DELETE(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 },
    );
  const token = req.cookies.get("mkt_session")?.value;
  await transact((s) => {
    s.sessions = s.sessions.filter((x) => x.hash !== tokenHash(token || ""));
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("mkt_session");
  return res;
}
