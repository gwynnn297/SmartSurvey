# smartservey - Hướng dẫn cài đặt và chạy dự án

## Yêu cầu hệ thống

- Java 17
- Gradle
- MySQL
- Git
- IDE: VS Code, IntelliJ IDEA hoặc Eclipse

## Các bước cài đặt



### . Cấu hình Database MySQL

- Tạo database:
  ```sql
  CREATE DATABASE smartservey CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  ```
- Đảm bảo user/password MySQL đúng như sau (hoặc sửa lại trong `src/main/resources/application.properties`):
  ```
  spring.datasource.username=root // sửa lại cho đúng với  username password trên mysql của mn
  spring.datasource.password=phuc290703
  ```

  ```

### . Cài đặt thư viện phụ thuộc


- dùng Gradle:
  ```bash
  ./gradlew build
  ```

### . Chạy ứng dụng

- Dùng Maven:
  ```bash
  mvn spring-boot:run
  ```
- Hoặc chạy file main: `/Users/tt/Documents/SmartServey/backend/src/main/resources/application.properties` (cài đặt Spring Boot Extension Pack) để có thể chạy được

### 6. Truy cập API

- Mặc định chạy ở port `8080`;
  http://localhost:8080


## Lưu ý

- Nếu lỗi kết nối database, kiểm tra lại cấu hình MySQL và quyền user.
- Đảm bảo các port không bị chiếm dụng.