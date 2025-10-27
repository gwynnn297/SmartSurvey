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

    // Associated options for multiple choice, single choice, etc.
    private List<OptionResponseDTO> options;

    // Note: Removed question config fields - using simplified approach
}