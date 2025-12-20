package vn.duytan.c1se09.smartsurvey.domain.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO trả về chi tiết survey cho admin
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminSurveyDetailDTO {
    private Long surveyId;
    private String title;
    private String description;
    private String status;
    
    // Creator info
    private Long userId;
    private String creatorName;
    private String creatorEmail;
    
    // Category info
    private Long categoryId;
    private String categoryName;
    
    // Statistics
    private Long questionCount;
    private Long responseCount;
    private Long viewCount;
    
    // Timestamps
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}



