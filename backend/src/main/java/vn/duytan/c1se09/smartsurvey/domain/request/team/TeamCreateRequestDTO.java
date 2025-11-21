package vn.duytan.c1se09.smartsurvey.domain.request.team;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TeamCreateRequestDTO {
    @NotBlank(message = "Tên team không được để trống")
    @Size(max = 255, message = "Tên team không được vượt quá 255 ký tự")
    private String name;

    @Size(max = 1000, message = "Mô tả không được vượt quá 1000 ký tự")
    private String description;
}































