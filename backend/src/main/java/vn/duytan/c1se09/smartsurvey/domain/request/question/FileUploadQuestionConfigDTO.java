package vn.duytan.c1se09.smartsurvey.domain.request.question;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class FileUploadQuestionConfigDTO {
    @NotEmpty(message = "Allowed file types không được để trống")
    private List<String> allowedFileTypes;

    @NotNull(message = "Max file size không được để trống")
    @Min(value = 1, message = "Max file size phải lớn hơn 0")
    private Long maxFileSize; // bytes

    @NotNull(message = "Max files không được để trống")
    @Min(value = 1, message = "Max files phải lớn hơn 0")
    private Integer maxFiles;
}