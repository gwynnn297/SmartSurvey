package vn.duytan.c1se09.smartsurvey.domain.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import vn.duytan.c1se09.smartsurvey.util.constant.RoleEnum;

/**
 * DTO để nhận dữ liệu từ client khi tạo user mới
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserRequestDTO {

    @NotBlank(message = "Họ tên không được để trống")
    @Size(max = 255, message = "Họ tên không được vượt quá 255 ký tự")
    private String fullName;

    @Email(message = "Email không hợp lệ")
    @NotBlank(message = "Email không được để trống")
    @Size(max = 255, message = "Email không được vượt quá 255 ký tự")
    private String email;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Size(min = 6, message = "Mật khẩu phải có ít nhất 6 ký tự")
    @Size(max = 255, message = "Mật khẩu không được vượt quá 255 ký tự")
    private String password;

    @Builder.Default
    private RoleEnum role = RoleEnum.creator; // Mặc định là creator
}
