package vn.duytan.c1se09.smartsurvey.domain.request.option;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OptionCreateRequestDTO {
    // Không bắt buộc vì có thể lấy từ URL
    private Long questionId;
    
    @NotBlank(message = "Nội dung tùy chọn không được để trống")
    private String optionText;
}