package vn.duytan.c1se09.smartsurvey.domain.request.question;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class MatrixQuestionConfigDTO {
    @NotEmpty(message = "Matrix rows không được để trống")
    private List<String> matrixRows;
    
    @NotEmpty(message = "Matrix columns không được để trống")
    private List<String> matrixColumns;
    
    @NotNull(message = "Matrix type không được để trống")
    private String matrixType; // "single_choice" hoặc "rating"
    
    // Chỉ áp dụng cho type "rating"
    private Integer minRating;
    private Integer maxRating;
}