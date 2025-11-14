package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyOverviewResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyTimelineResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyChartsResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyTextAnalysisResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveySentimentResponseDTO;
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
    
    /**
     * Lấy dữ liệu biểu đồ cho survey (multiple choice, rating, boolean questions)
     * GET /api/surveys/{surveyId}/results/charts
     */
    @GetMapping("/{surveyId}/results/charts")
    @ApiMessage("Lấy dữ liệu biểu đồ cho survey")
    public ResponseEntity<SurveyChartsResponseDTO> getSurveyCharts(@PathVariable Long surveyId) {
        try {
            SurveyChartsResponseDTO charts = statisticsService.getSurveyCharts(surveyId);
            return ResponseEntity.ok(charts);
        } catch (IdInvalidException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Lấy phân tích văn bản AI cho các câu hỏi mở
     * GET /api/surveys/{surveyId}/results/text-analysis
     */
    @GetMapping("/{surveyId}/results/text-analysis")
    @ApiMessage("Lấy phân tích văn bản AI cho survey")
    public ResponseEntity<SurveyTextAnalysisResponseDTO> getSurveyTextAnalysis(@PathVariable Long surveyId) {
        try {
            SurveyTextAnalysisResponseDTO textAnalysis = statisticsService.getSurveyTextAnalysis(surveyId);
            return ResponseEntity.ok(textAnalysis);
        } catch (IdInvalidException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Lấy phân tích cảm xúc AI cho survey
     * GET /api/surveys/{surveyId}/results/sentiment
     */
    @GetMapping("/{surveyId}/results/sentiment")
    @ApiMessage("Lấy phân tích cảm xúc AI cho survey")
    public ResponseEntity<SurveySentimentResponseDTO> getSurveySentimentAnalysis(@PathVariable Long surveyId) {
        try {
            SurveySentimentResponseDTO sentiment = statisticsService.getSurveySentimentAnalysis(surveyId);
            return ResponseEntity.ok(sentiment);
        } catch (IdInvalidException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}


