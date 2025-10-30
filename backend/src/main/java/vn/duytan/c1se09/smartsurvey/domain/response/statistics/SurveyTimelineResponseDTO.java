package vn.duytan.c1se09.smartsurvey.domain.response.statistics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO cho timeline responses của survey
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SurveyTimelineResponseDTO {
    
    private Long surveyId;
    private String surveyTitle;
    
    // Timeline data
    private List<DailyDataDTO> daily;   // Dữ liệu theo ngày
    private List<HourlyDataDTO> hourly; // Dữ liệu theo giờ
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyDataDTO {
        private String date;        // Format: "2025-10-15"
        private Integer count;      // Tổng số responses trong ngày
        private Integer completed;  // Số responses hoàn thành trong ngày
        private Integer partial;    // Số responses partial trong ngày
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HourlyDataDTO {
        private String hour;        // Format: "14:00"
        private Integer count;      // Tổng số responses trong giờ
        private Integer completed;  // Số responses hoàn thành trong giờ
    }
}







