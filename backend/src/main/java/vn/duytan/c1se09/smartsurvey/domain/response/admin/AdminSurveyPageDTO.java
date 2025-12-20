package vn.duytan.c1se09.smartsurvey.domain.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO trả về danh sách surveys với phân trang cho admin
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminSurveyPageDTO {
    private List<SurveyDTO> surveys;
    private Long totalElements;
    private Integer totalPages;
    private Integer currentPage;
    private Integer pageSize;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SurveyDTO {
        private Long surveyId;
        private String title;
        private String description;
        private String status;
        private Long userId;           // Creator ID
        private String creatorName;    // Creator full name
        private String creatorEmail;   // Creator email
        private Long categoryId;
        private String categoryName;
        private Long responseCount;    // Số responses
        private Long questionCount;    // Số questions
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
}


