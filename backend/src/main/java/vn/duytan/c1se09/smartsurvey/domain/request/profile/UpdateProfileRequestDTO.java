package vn.duytan.c1se09.smartsurvey.domain.request.profile;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/**
 * DTO cho request cập nhật profile
 */
@Getter
@Setter
public class UpdateProfileRequestDTO {

    @NotBlank(message = "Họ tên không được để trống")
    private String fullName;
}
