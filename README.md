# Sao Việt Marketing Hub — bản TEST

Web quản lý Marketing Long Thành, dùng Next.js App Router. Bản TEST đã có đăng nhập, phân quyền tại máy chủ, giao việc, tiến độ, nhận xét, nhật ký, lịch, thư viện và social luân phiên. Không tự xuất bản nội dung hoặc gửi email/Facebook/Zalo.

## Chạy trên máy

Yêu cầu Node.js 24 và npm.

```sh
npm ci
npm run setup:local
npm run dev
```

Mở http://localhost:3100. Script setup tạo mật khẩu ngẫu nhiên trong `.local/TEST-ACCESS.txt` và `.env.local`; các tệp này không đưa lên Git. Trong development trên localhost, ba nút TEST cho phép thử vai trò. Dữ liệu được lưu trong `.local/state.json`, vẫn còn khi tải lại hoặc khởi động lại máy chủ. Chỉ chạy một tiến trình máy chủ khi dùng lưu trữ local. Sao lưu thư mục `.local` trước khi di chuyển máy.

Không đưa máy chủ development qua tunnel hoặc public Internet. Nút TEST bị vô hiệu hóa khi `NODE_ENV=production` hoặc chạy Vercel. Đăng nhập tài khoản thật vẫn hoạt động trong production. Tài khoản owner được tạo khi kho dữ liệu trống; thay ADMIN_PASSWORD sau đó không đổi mật khẩu tài khoản đã có. Đổi mật khẩu trong Cài đặt sẽ thu hồi các phiên hiện có.

## Quyền và quy trình

| Vai trò       | Quyền                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------- |
| Chủ trung tâm | Mọi công việc; tạo/khóa tài khoản; đổi vai trò quản lý/nhân viên; lịch nhắc              |
| Quản lý       | Xem toàn bộ; tạo, giao, điều chỉnh, nghiệm thu công việc và cập nhật trạng thái xuất bản |
| Nhân viên     | Chỉ công việc được giao; cập nhật tiến độ, chuyển Đang làm/Chờ duyệt, trao đổi           |

Trạng thái sản xuất tách riêng Bản nháp / Đã duyệt / Đã bàn giao / Đã xuất bản. Đánh dấu xuất bản cần URL HTTPS; social kiểm tra domain khớp nền tảng. Quản lý phải mở URL kiểm tra bài thực tế: ứng dụng chưa tự kiểm chứng bài tồn tại hoặc đúng tài khoản. Các tỷ lệ tiến độ nhập ban đầu là mốc quy ước theo giai đoạn, không phải giờ công đã đo.

VD05 được gộp trong lịch sử VD01. Social có tổng 3 vị trí/tuần, mỗi vị trí một nền tảng khác nhau, luân phiên 11 nền tảng từ tuần 23/11/2026. Quản lý có thể đổi nền tảng khi phù hợp nhưng không trùng trong tuần. Gravatar cần đối chiếu loại nội dung phù hợp. Tumblr giữ ghi chú fake IP, web không đổi cấu hình mạng. Tuần mới và việc rà ngày mới được tạo khi truy cập, không phải một tác vụ chạy nền độc lập.

Nhắc trong web xuất hiện khi truy cập sau giờ cài đặt (mặc định 10:00, giờ Việt Nam), gồm việc đến hạn và chờ duyệt. Thông báo trình duyệt cần được người dùng bật và trang còn mở. Lịch nhắc Codex đã có là một hệ thống riêng, không tự đồng bộ với cài đặt này. Chưa có gửi nhắc khi đóng web qua email/Facebook/Zalo.

## Chuẩn bị Vercel và PostgreSQL

Chưa kết nối hoặc triển khai Vercel; chưa kiểm thử với PostgreSQL thật. Repo đã có adapter PostgreSQL (`pg`), transaction và khóa để tránh mất cập nhật. Bản TEST lưu một bản trạng thái JSONB, phù hợp đội nhỏ; khi mở rộng cần tách bảng, migration và chính sách lưu nhật ký.

1. Import repo vào Vercel, framework Next.js, root là thư mục repo. Lệnh build `npm run build`.
2. Cấp cơ sở dữ liệu PostgreSQL. Cấu hình `DATABASE_URL` theo chuỗi kết nối TLS của nhà cung cấp; tài khoản DB cần tạo bảng `mkt_state` khi khởi tạo.
3. Cấu hình `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` (ít nhất 12 ký tự, dùng mật khẩu riêng), `LOCAL_TEST_LOGIN=false`. Không commit các giá trị bí mật.
4. Deploy Preview rồi kiểm tra đăng nhập, tạo nhân viên TEST, giao việc, cập nhật và reload trước khi dùng thật. Bản chạy trên Vercel từ chối lưu filesystem khi thiếu DATABASE_URL.
5. Lần đầu DB trống sẽ nhập danh sách nguồn và owner mới. Dữ liệu thay đổi trên local **không tự chuyển lên DB**. Khi chuyển dữ liệu cần migration có kiểm tra và sao lưu; không upload `.local/state.json` công khai vì chứa thông tin xác thực.

Ảnh lớp học/caption hiện tại chỉ nằm trong `.local/assets` trên máy gốc, truy cập qua API có kiểm tra quyền. Chúng không nằm trong repo, nên chưa mở được trên Vercel. Cần bổ sung lưu trữ tệp riêng và chuyển tư liệu có quyền truy cập trước khi bàn giao online.

## Kiểm tra và tiến trình

```sh
npm run typecheck
npm test
npm run test:api
npm run build
```

`test:api` cần máy chủ development local đang chạy. Kiểm tra HTTP đăng nhập ba vai trò, chống yêu cầu khác origin, lọc dữ liệu, tải lại và thu hồi phiên; không đổi công việc thật. Unit tests kiểm tra quyền sửa, phiên bản xung đột, khóa tài khoản, gộp VD05, ngày Việt Nam, social luân phiên và URL. GitHub Actions chạy typecheck, unit tests và build.

Mục **Tiến trình xây dựng** đọc `data/build-progress.json`. Khi hoàn thành một hạng mục, cập nhật tệp này theo kết quả thật, commit và deploy để phản ánh lên web. Tiến độ các công việc Marketing được cập nhật ngay trong ứng dụng, lưu trên máy chủ và tải lại mỗi 20 giây. Người dùng cần duyệt bản TEST trước khi triển khai rộng.
