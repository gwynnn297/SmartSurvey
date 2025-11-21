package vn.duytan.c1se09.smartsurvey.domain.response.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO trả về dashboard overview cho user
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDashboardResponseDTO {
    private Long ownedSurveys;      // Số survey user sở hữu
    private Long sharedSurveys;      // Số survey được share với user
    private Long totalSurveys;       // Tổng số survey (owned + shared)
    private Long activeSurveys;      // Số survey đang published
    private Long totalResponses;     // Tổng số responses của tất cả surveys
    private Long totalTeams;         // Số teams user tham gia
    private List<SharedSurveyDTO> sharedSurveysDetail; // Danh sách survey được share
    private List<ActivityDTO> recentActivity; // Hoạt động gần nhất

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActivityDTO {
        private String actionType;
        private String description;
        private Long targetId;
        private String targetTable;
        private LocalDateTime createdAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SharedSurveyDTO {
        private Long surveyId;
        private String title;
        private String permission;
        private String sharedVia; // "team" hoặc "user"
    }
}

