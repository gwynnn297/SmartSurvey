package vn.duytan.c1se09.smartsurvey.domain.response.question;

import lombok.Data;
import vn.duytan.c1se09.smartsurvey.domain.response.option.OptionResponseDTO;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class QuestionDetailResponseDTO {
    private Long id;
    private Long surveyId;
    private String surveyTitle;
    private String questionText;
    private String questionType;
    private String questionTypeDescription;
    private Boolean isRequired;
    private Integer displayOrder;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Danh sách tùy chọn của câu hỏi
    private List<OptionResponseDTO> options;
}