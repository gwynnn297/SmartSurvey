package vn.duytan.c1se09.smartsurvey.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

import vn.duytan.c1se09.smartsurvey.util.constant.RoleEnum;

/**
 * Entity đại diện cho bảng users trong database
 * Phù hợp với schema database SmartSurvey
 */
@Entity
@Table(name = "users")
@Getter
@Setter
public class User {

    // user_id từ schema database
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long userId;

    // full_name từ schema
    @NotBlank(message = "Họ tên không được để trống")
    @Column(name = "full_name", nullable = false, length = 255)
    private String fullName;

    // email từ schema
    @Email(message = "Email không hợp lệ")
    @NotBlank(message = "Email không được để trống")
    @Column(name = "email", unique = true, nullable = false, length = 255)
    private String email;

    // password_hash từ schema (đổi từ password)
    @NotBlank(message = "Mật khẩu không được để trống")
    @Size(min = 6, message = "Mật khẩu phải có ít nhất 6 ký tự")
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    // role từ schema - cập nhật enum values
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private RoleEnum role = RoleEnum.creator;

    // is_active từ schema - THIẾU trong code cũ
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    // created_at và updated_at từ schema
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Callback methods
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

}
