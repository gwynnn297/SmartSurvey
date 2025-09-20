package vn.duytan.c1se09.smartsurvey.domain.request.option;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class OptionCreateRequestDTO {
    @NotNull(message = "Question ID không được để trống")
    private Long questionId;
    
    @NotBlank(message = "Nội dung tùy chọn không được để trống")
    private String optionText;
}