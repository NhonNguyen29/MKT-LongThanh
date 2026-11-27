# Sao Việt Marketing Hub — bản TEST

Web quản lý Marketing Long Thành, dùng Next.js App Router. Có đăng nhập, phân quyền tại máy chủ, giao việc, tiến độ, nhận xét, nhật ký, lịch, thư viện và social luân phiên. Gmail gửi thông báo công việc khi cấu hình; không tự xuất bản nội dung lên các kênh.

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

Cập nhật 27/11: ảnh minh chứng và link kết quả bắt buộc khi **nhân viên gửi duyệt** (việc Kho Media kiểm tra tệp đã tải lên). **Chủ trung tâm/Quản lý** được giao việc, sửa thông tin, chuyển trạng thái và nghiệm thu mà không bắt buộc tự tải ảnh hoặc nhập link. Phần kết quả vẫn hiển thị để đối chiếu minh chứng nhân viên nộp. Với mọi vai trò được phép ghi nhận xuất bản, trạng thái **Đã xuất bản** vẫn cần URL HTTPS thực tế; hoàn thành công việc không tự chuyển thành đã xuất bản.

| Vai trò       | Quyền                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------- |
| Chủ trung tâm | Mọi công việc; tạo/khóa tài khoản; đổi vai trò quản lý/nhân viên; lịch nhắc              |
| Quản lý       | Xem toàn bộ; tạo, giao, điều chỉnh, nghiệm thu công việc và cập nhật trạng thái xuất bản |
| Nhân viên     | Chỉ công việc được giao; cập nhật tiến độ, chuyển Đang làm/Chờ duyệt, trao đổi           |

Trạng thái sản xuất tách riêng Bản nháp / Đã duyệt / Đã bàn giao / Đã xuất bản. Đánh dấu xuất bản cần URL HTTPS; social kiểm tra domain khớp nền tảng. Quản lý phải mở URL kiểm tra bài thực tế: ứng dụng chưa tự kiểm chứng bài tồn tại hoặc đúng tài khoản. Các tỷ lệ tiến độ nhập ban đầu là mốc quy ước theo giai đoạn, không phải giờ công đã đo.

VD05 được gộp trong lịch sử VD01. Social có tổng 3 vị trí/tuần, mỗi vị trí một nền tảng khác nhau, luân phiên 11 nền tảng từ tuần 23/11/2026. Quản lý có thể đổi nền tảng khi phù hợp nhưng không trùng trong tuần. Gravatar cần đối chiếu loại nội dung phù hợp. Tumblr giữ ghi chú fake IP, web không đổi cấu hình mạng. Tuần mới và việc rà ngày mới được tạo khi truy cập, không phải một tác vụ chạy nền độc lập.

Nhắc trong web xuất hiện khi truy cập sau giờ cài đặt, gồm việc đến hạn và chờ duyệt. Thông báo trình duyệt cần được bật và trang còn mở. Lịch nhắc Codex là hệ thống riêng. Email Gmail chạy trên máy chủ theo lịch 09:00 giờ Việt Nam trong `vercel.json`, độc lập với giờ nhắc trong web; không cần mở trình duyệt. Facebook/Zalo chưa tích hợp.

## Thông báo Gmail

- Khi giao hoặc đổi người phụ trách: báo người được giao.
- Khi nhân viên chuyển sang Chờ duyệt: báo chủ trung tâm và quản lý đang hoạt động.
- Khi quản lý yêu cầu sửa hoặc nghiệm thu: báo nhân viên phụ trách.
- Nhắc hằng ngày chỉ gửi nếu có việc đang mở phù hợp quyền/tuần; không nhắc việc hoàn thành, tạm dừng, lưu trữ hoặc đang chờ quản lý duyệt.
- Trong **Cài đặt & nhắc nhở**, quản lý có nút gửi nhắc ngay, gửi kiểm tra về chính email của mình và nhật ký gửi. Chủ trung tâm có thể gửi lại lượt lỗi sau khi kiểm tra hộp thư để tránh trùng.

Cấu hình biến bí mật `GMAIL_APP_PASSWORD`, `CRON_SECRET` và biến `GMAIL_USER`, `APP_URL` trên Vercel Production. Không bật gửi Gmail cho Preview. Google App Password khác mật khẩu đăng nhập web/Gmail chính; xem [hướng dẫn Google](https://support.google.com/accounts/answer/185833). Cron từ chối yêu cầu khi thiếu hoặc sai secret.

Sự kiện email được ghi cùng transaction lưu việc, rồi gửi có chờ kết quả. Lỗi Gmail không hủy công việc đã lưu. Mỗi lượt nhắc ngày chỉ có một khóa cho một người nhận; thao tác gửi nhắc thủ công được chống lặp trong cùng khung 5 phút. Hệ thống kiểm tra lại tài khoản và quyền công việc trước khi gửi. SMTP chấp nhận email được ghi **Gmail đã nhận gửi**, không khẳng định vào Inbox hoặc đã đọc. Lượt SMTP thất bại cần người quản lý kiểm tra trước khi gửi lại; lượt đang gửi bị ngắt không tự gửi lại vì có thể gây trùng. Lịch Vercel chạy theo khả năng gói dịch vụ, không cam kết đúng tuyệt đối từng phút.

## Vercel và Supabase — chuẩn bị triển khai online

Người dùng đã duyệt bản TEST và yêu cầu đưa lên Vercel với cơ sở dữ liệu Supabase. Mã kết nối và chuyển dữ liệu đã chuẩn bị; hiện chưa kết nối tài khoản, chưa triển khai online và chưa kiểm thử với PostgreSQL thật. Adapter PostgreSQL (`pg`) dùng transaction và khóa để tránh mất cập nhật. Dữ liệu nằm trong schema riêng `saoviet_private`, không qua Data API công khai. Bản này lưu một trạng thái JSONB, phù hợp đội nhỏ; khi mở rộng cần tách bảng và chính sách lưu nhật ký.

1. Import repo vào Vercel, framework Next.js, root là thư mục repo. Lệnh build `npm run build`.
2. Tạo/chọn project Supabase dành cho ứng dụng. Dùng URI **Transaction pooler** từ mục Connect, bật TLS theo hướng dẫn kết nối của project. Không tự đoán hostname. Không thêm `saoviet_private` vào exposed schemas. Chi tiết: [Supabase kết nối PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres), [quyền truy cập Data API](https://supabase.com/docs/guides/api/securing-your-api).
3. Tạo `.env.production.local` (đã được Git bỏ qua), gồm `DATABASE_URL`, `ADMIN_EMAIL` thật, `ADMIN_NAME`, `ADMIN_PASSWORD` mới ít nhất 16 ký tự, `LOCAL_TEST_LOGIN=false`. Không dùng mật khẩu TEST. Sao lưu `.local` trước khi chuyển dữ liệu.
4. Chạy `npm run db:migrate` để tạo schema riêng và khóa quyền Data API. Sau đó chạy `npm run db:import` để chuyển công việc và sáu tư liệu. Import bỏ hai tài khoản TEST, nhiệm vụ kiểm thử đã biết, các phiên đăng nhập local, đồng thời đổi email/mật khẩu owner. Import từ chối ghi đè DB đã có dữ liệu; mọi thay đổi trong lượt import dùng một transaction.
5. Đưa các biến môi trường tương ứng vào Vercel phía máy chủ, không đặt tiền tố `NEXT_PUBLIC_`. Bản chạy trên Vercel từ chối lưu filesystem khi thiếu DATABASE_URL; nút đăng nhập TEST luôn tắt. Lệnh `db:migrate`/`db:import` là thao tác quản trị một lần, không đưa vào build command.
6. Deploy và kiểm tra đăng nhập owner, giao việc/nhân viên, cập nhật, reload, mở tư liệu và chặn truy cập chưa đăng nhập trước khi bàn giao URL. Tài khoản nhân viên thật được chủ trung tâm tạo trong **Nhân sự & phân quyền**; chưa có email mời hoặc quên mật khẩu tự động.

Ảnh lớp học/caption không nằm trong Git. Script import chuyển sáu tệp hiện tại vào `saoviet_private.mkt_assets` (mỗi tệp dưới 4 MB), chỉ đọc qua API ứng dụng sau kiểm tra người dùng và quyền công việc. Runtime vẫn dùng `.local/assets` khi chạy local không có DATABASE_URL. Với thư viện video/tệp lớn trong tương lai, dùng Supabase Storage riêng thay vì bảng bytea hiện tại. Chưa có chức năng tải tư liệu mới lên web.

## Kiểm tra và tiến trình

```sh
npm run typecheck
npm test
npm run test:api
npm run build
```

`test:api` cần máy chủ development local đang chạy. Kiểm tra HTTP đăng nhập ba vai trò, chống yêu cầu khác origin, lọc dữ liệu, tải lại và thu hồi phiên; không đổi công việc thật. Unit tests kiểm tra quyền sửa, phiên bản xung đột, khóa tài khoản, gộp VD05, ngày Việt Nam, social luân phiên và URL. GitHub Actions chạy typecheck, unit tests và build.

Mục **Tiến trình xây dựng** đọc `data/build-progress.json`. Khi hoàn thành một hạng mục, cập nhật tệp này theo kết quả thật, commit và deploy để phản ánh lên web. Tiến độ các công việc Marketing được cập nhật ngay trong ứng dụng, lưu trên máy chủ và tải lại mỗi 20 giây. Người dùng cần duyệt bản TEST trước khi triển khai rộng.

### Bản TEST nhận việc & giao diện Sunset — 27/11/2026

Nhân viên mở công việc và bấm **Đã nhận việc** để xác nhận trách nhiệm. Xác nhận này độc lập với trạng thái Đang làm/Hoàn thành, không yêu cầu ảnh minh chứng hay URL. Chỉ người được giao đang có quyền xem mới được xác nhận; quản lý không nhận thay nhân viên. Máy chủ lưu người nhận, thời gian Việt Nam và nhật ký; lần bấm lặp không tạo thêm xác nhận. Đổi hoặc bỏ người phụ trách sẽ xóa xác nhận hiện hành, giữ lịch sử trong nhật ký. Những công việc cũ chưa có xác nhận không được tự đánh dấu đã nhận.

Quản lý xem tên/thời gian trong bảng, modal, social và thông báo trong web. Bộ lọc **Cần giao / Chưa nhận / Đã nhận / Quá hạn** chỉ tính việc chưa đóng, chưa tạm dừng, chưa lưu trữ; **Tất cả** giữ toàn bộ việc chưa lưu trữ. Có lọc theo nhân viên và xóa bộ lọc. Mobile hiển thị thẻ công việc; màu tím–hồng–cam và logo nền trắng.

Đây là bản TEST chờ người dùng duyệt, chưa cập nhật production. Không có xóa vĩnh viễn; lưu trữ có hộp xác nhận và có thể khôi phục. Đề xuất tiếp theo: Thùng rác khôi phục, giao nhiều việc một lần và nhắc riêng việc chưa nhận.

Kiểm tra: 24 test đạt; TypeScript và production build đạt. Luồng trình duyệt local đã xác minh: tạo việc → nhân viên nhận → reload → quản lý thấy tên/thời gian, bộ đếm và thông báo. Kiểm tra desktop 1440px và mobile 390px; console không có lỗi. Dữ liệu TEST local, không gửi Gmail thật và không sửa dữ liệu online.
