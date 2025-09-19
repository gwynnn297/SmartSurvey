package vn.duytan.c1se09.smartsurvey.domain.response.option;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class OptionUpdateResponseDTO {
    private Long id;
    private Long questionId;
    private String questionText;
    private String optionText;
    private String message;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
} 