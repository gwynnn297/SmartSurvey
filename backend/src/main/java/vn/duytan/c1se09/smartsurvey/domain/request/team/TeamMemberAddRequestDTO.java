package vn.duytan.c1se09.smartsurvey.domain.request.team;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * DTO để thêm member vào team
 * Chỉ cần email, không cần chọn role (mặc định là VIEWER)
 */
@Data
public class TeamMemberAddRequestDTO {
    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không hợp lệ")
    private String email;
}





















