package vn.duytan.c1se09.smartsurvey.domain.request.team;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * DTO để gửi lời mời tham gia team
 */
@Data
public class TeamInvitationRequestDTO {
    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không hợp lệ")
    private String email;
    
    private String message; // Lời nhắn tùy chọn
}













