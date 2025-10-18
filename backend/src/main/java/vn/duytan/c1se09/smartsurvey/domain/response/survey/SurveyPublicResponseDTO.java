package vn.duytan.c1se09.smartsurvey.domain.response.survey;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO cho API public survey - không chứa thông tin nhạy cảm
 */
@Data
public class SurveyPublicResponseDTO {
    private Long id;
    private String title;
    private String description;
    private String status;
    private String categoryName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Danh sách câu hỏi công khai (không có AI prompt, user info)
    private List<QuestionPublicDTO> questions;
    
    @Data
    public static class QuestionPublicDTO {
        private Long id;
        private String text;
        private String type;
        private Boolean required;
        private Integer order;
        private List<OptionPublicDTO> options;
    }
    
    @Data
    public static class OptionPublicDTO {
        private Long id;
        private String text;
    }
}





