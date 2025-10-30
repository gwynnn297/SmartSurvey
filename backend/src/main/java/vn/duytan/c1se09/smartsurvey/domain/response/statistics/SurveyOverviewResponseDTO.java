package vn.duytan.c1se09.smartsurvey.domain.response.statistics;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Response DTO cho thống kê tổng quan survey
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SurveyOverviewResponseDTO {
    
    private Long surveyId;
    private String surveyTitle;
    
    // Thống kê cơ bản
    private Integer totalResponses;
    private Integer viewership; // Tổng số lần mở form (không phân biệt IP)
    private Double completionRate; // Phần trăm hoàn thành
    private String avgCompletionTime; // Thời gian trung bình hoàn thành (format: "5m 30s")
    
    // Thông tin thời gian
    private LocalDateTime createdAt;
    private LocalDateTime lastResponseAt;
    private String status; // "active", "draft", "archived"
    
    // Demographics
    private DemographicsDTO demographics;
    
    // Completion statistics
    private CompletionStatsDTO completionStats;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DemographicsDTO {
        private Map<String, Integer> ageGroups; // {"18-25": 45, "26-35": 67}
        private Map<String, Integer> genderDistribution; // {"male": 78, "female": 78}
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CompletionStatsDTO {
        private Integer completed; // Số responses hoàn thành đầy đủ
        private Integer partial;   // Số responses trả lời một phần
        private Integer dropped;   // Số responses bị drop (có thể tính từ total - completed - partial)
    }
}
