import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env.local")) {
  console.log("Giữ nguyên .env.local đã có.");
  process.exit(0);
}
const password = randomBytes(18).toString("base64url");
mkdirSync(".local", { recursive: true });
writeFileSync(
  ".env.local",
  `ADMIN_EMAIL=admin@saoviet.local\nADMIN_NAME=Chủ trung tâm\nADMIN_PASSWORD=${password}\nLOCAL_TEST_LOGIN=true\n`,
);
writeFileSync(
  ".local/TEST-ACCESS.txt",
  `LOCAL TEST ONLY\nURL: http://localhost:3100\nEmail: admin@saoviet.local\nPassword: ${password}\nTệp này bị Git bỏ qua. Không dùng thông tin TEST làm mật khẩu production.\n`,
);
console.log(
  "Đã tạo cấu hình local. Thông tin đăng nhập nằm trong .local/TEST-ACCESS.txt (không đưa lên Git).",
);
