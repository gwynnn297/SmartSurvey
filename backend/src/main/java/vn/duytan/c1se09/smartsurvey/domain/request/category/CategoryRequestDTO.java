package vn.duytan.c1se09.smartsurvey.domain.request.category;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CategoryRequestDTO {
    @NotBlank(message = "Tên danh mục không được để trống")
    private String categoryName;
}
