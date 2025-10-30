package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyOverviewResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyTimelineResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.StatisticsService;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyQuestionCountsDTO;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

/**
 * Controller cho thống kê và báo cáo
 */
@RestController
@RequestMapping("/api/surveys")
@RequiredArgsConstructor
public class StatisticsController {
    
    private final StatisticsService statisticsService;
    
    /**
     * Lấy thống kê tổng quan của survey
     * GET /api/surveys/{surveyId}/results/overview
     */
    @GetMapping("/{surveyId}/results/overview")
    @ApiMessage("Lấy thống kê tổng quan của survey")
    public ResponseEntity<SurveyOverviewResponseDTO> getSurveyOverview(@PathVariable Long surveyId) {
        try {
            SurveyOverviewResponseDTO overview = statisticsService.getSurveyOverview(surveyId);
            return ResponseEntity.ok(overview);
        } catch (IdInvalidException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Lấy timeline responses của survey
     * GET /api/surveys/{surveyId}/results/timeline
     */
    @GetMapping("/{surveyId}/results/timeline")
    @ApiMessage("Lấy timeline responses của survey")
    public ResponseEntity<SurveyTimelineResponseDTO> getSurveyTimeline(@PathVariable Long surveyId) {
        try {
            SurveyTimelineResponseDTO timeline = statisticsService.getSurveyTimeline(surveyId);
            return ResponseEntity.ok(timeline);
        } catch (IdInvalidException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Đếm nhanh số câu hỏi theo loại cho overview
     * GET /api/surveys/{surveyId}/results/question-counts
     */
    @GetMapping("/{surveyId}/results/question-counts")
    @ApiMessage("Thống kê số câu hỏi theo loại")
    public ResponseEntity<SurveyQuestionCountsDTO> getSurveyQuestionCounts(@PathVariable Long surveyId) {
        try {
            SurveyQuestionCountsDTO counts = statisticsService.getSurveyQuestionCounts(surveyId);
            return ResponseEntity.ok(counts);
        } catch (IdInvalidException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}


