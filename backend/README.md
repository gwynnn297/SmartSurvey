# smartservey - Hướng dẫn cài đặt và chạy dự án

## Yêu cầu hệ thống

- Java 17
- Gradle
- MySQL
- Git
- IDE: VS Code, IntelliJ IDEA hoặc Eclipse

## Các bước cài đặt



### . Cấu hình Database MySQL (không hardcode)

- Tạo database:
  ```sql
  CREATE DATABASE smartsurvey CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  ```
- Không sửa file `src/main/resources/application.properties` để đổi password. Thay vào đó dùng 1 trong 2 cách:
  1) Dùng biến môi trường (khuyên dùng):
     ```zsh
     # macOS zsh - đặt trong ~/.zshrc hoặc chạy trước khi start app
     export DB_USERNAME="root"
     export DB_PASSWORD="<your_mysql_password>"
     export MYSQL_HOST="localhost"
     export JWT_SECRET="<optional_custom_jwt_secret>"
     ```
  2) Dùng file local override (đã ignore):
     - Copy file mẫu: `cp application-local.properties.example application-local.properties`
     - Sửa giá trị trong `application-local.properties` cho máy của bạn.

Ứng dụng sẽ tự đọc biến môi trường hoặc file `application-local.properties` (nếu có). Không cần commit password lên repo.

### . Cài đặt thư viện phụ thuộc


- dùng Gradle:
  ```bash
  ./gradlew build
  ```

### . Chạy ứng dụng

- Dùng Gradle:
  ```bash
  ./gradlew bootRun
  ```
- Hoặc chạy bằng IDE (Spring Boot run configuration). Hãy đảm bảo đã set env vars hoặc có file `application-local.properties`.

### 6. Truy cập API

- Mặc định chạy ở port `8080`;
  http://localhost:8080


## Lưu ý

- Nếu lỗi kết nối database, kiểm tra lại cấu hình MySQL và quyền user.
- Đảm bảo các port không bị chiếm dụng.