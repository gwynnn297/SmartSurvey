package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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

import java.util.HashMap;
import java.util.Map;

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
     * Chỉ OWNER và ANALYST mới có quyền xem báo cáo (kiểm tra trong StatisticsService)
     */
    @GetMapping("/{surveyId}/results/overview")
    @ApiMessage("Lấy thống kê tổng quan của survey")
    public ResponseEntity<?> getSurveyOverview(@PathVariable Long surveyId) {
        try {
            SurveyOverviewResponseDTO overview = statisticsService.getSurveyOverview(surveyId);
            return ResponseEntity.ok(overview);
        } catch (IdInvalidException e) {
            // Kiểm tra nếu lỗi liên quan đến quyền truy cập
            Map<String, String> errorResponse = new HashMap<>();
            if (e.getMessage() != null && e.getMessage().contains("quyền")) {
                errorResponse.put("message", e.getMessage());
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
            }
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi hệ thống: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Lấy timeline responses của survey
     * GET /api/surveys/{surveyId}/results/timeline
     * Chỉ OWNER và ANALYST mới có quyền xem báo cáo (kiểm tra trong StatisticsService)
     */
    @GetMapping("/{surveyId}/results/timeline")
    @ApiMessage("Lấy timeline responses của survey")
    public ResponseEntity<?> getSurveyTimeline(@PathVariable Long surveyId) {
        try {
            SurveyTimelineResponseDTO timeline = statisticsService.getSurveyTimeline(surveyId);
            return ResponseEntity.ok(timeline);
        } catch (IdInvalidException e) {
            // Kiểm tra nếu lỗi liên quan đến quyền truy cập
            Map<String, String> errorResponse = new HashMap<>();
            if (e.getMessage() != null && e.getMessage().contains("quyền")) {
                errorResponse.put("message", e.getMessage());
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
            }
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi hệ thống: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Đếm nhanh số câu hỏi theo loại cho overview
     * GET /api/surveys/{surveyId}/results/question-counts
     * Chỉ OWNER và ANALYST mới có quyền xem báo cáo (kiểm tra trong StatisticsService)
     */
    @GetMapping("/{surveyId}/results/question-counts")
    @ApiMessage("Thống kê số câu hỏi theo loại")
    public ResponseEntity<?> getSurveyQuestionCounts(@PathVariable Long surveyId) {
        try {
            SurveyQuestionCountsDTO counts = statisticsService.getSurveyQuestionCounts(surveyId);
            return ResponseEntity.ok(counts);
        } catch (IdInvalidException e) {
            // Kiểm tra nếu lỗi liên quan đến quyền truy cập
            Map<String, String> errorResponse = new HashMap<>();
            if (e.getMessage() != null && e.getMessage().contains("quyền")) {
                errorResponse.put("message", e.getMessage());
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
            }
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi hệ thống: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Lấy dữ liệu biểu đồ cho survey (multiple choice/single
     * choice/ranking/rating/bolean)
     * GET /api/surveys/{surveyId}/results/charts
     * Chỉ OWNER và ANALYST mới có quyền xem báo cáo (kiểm tra trong StatisticsService)
     */
    @GetMapping("/{surveyId}/results/charts")
    @ApiMessage("Lấy dữ liệu biểu đồ cho survey")
    public ResponseEntity<?> getSurveyCharts(@PathVariable Long surveyId) {
        try {
            SurveyChartsResponseDTO charts = statisticsService.getSurveyCharts(surveyId);
            return ResponseEntity.ok(charts);
        } catch (IdInvalidException e) {
            // Kiểm tra nếu lỗi liên quan đến quyền truy cập
            Map<String, String> errorResponse = new HashMap<>();
            if (e.getMessage() != null && e.getMessage().contains("quyền")) {
                errorResponse.put("message", e.getMessage());
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
            }
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi hệ thống: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Lấy phân tích văn bản AI cho các câu hỏi mở
     * GET /api/surveys/{surveyId}/results/text-analysis
     * Chỉ OWNER và ANALYST mới có quyền xem báo cáo (kiểm tra trong StatisticsService)
     */
    @GetMapping("/{surveyId}/results/text-analysis")
    @ApiMessage("Lấy phân tích văn bản AI cho survey")
    public ResponseEntity<?> getSurveyTextAnalysis(@PathVariable Long surveyId) {
        try {
            SurveyTextAnalysisResponseDTO textAnalysis = statisticsService.getSurveyTextAnalysis(surveyId);
            return ResponseEntity.ok(textAnalysis);
        } catch (IdInvalidException e) {
            // Kiểm tra nếu lỗi liên quan đến quyền truy cập
            Map<String, String> errorResponse = new HashMap<>();
            if (e.getMessage() != null && e.getMessage().contains("quyền")) {
                errorResponse.put("message", e.getMessage());
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
            }
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi hệ thống: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Lấy phân tích cảm xúc AI cho survey
     * GET /api/surveys/{surveyId}/results/sentiment
     * Chỉ OWNER và ANALYST mới có quyền xem báo cáo (kiểm tra trong StatisticsService)
     */
    @GetMapping("/{surveyId}/results/sentiment")
    @ApiMessage("Lấy phân tích cảm xúc AI cho survey")
    public ResponseEntity<?> getSurveySentimentAnalysis(@PathVariable Long surveyId) {
        try {
            SurveySentimentResponseDTO sentiment = statisticsService.getSurveySentimentAnalysis(surveyId);
            return ResponseEntity.ok(sentiment);
        } catch (IdInvalidException e) {
            // Kiểm tra nếu lỗi liên quan đến quyền truy cập
            Map<String, String> errorResponse = new HashMap<>();
            if (e.getMessage() != null && e.getMessage().contains("quyền")) {
                errorResponse.put("message", e.getMessage());
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
            }
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi hệ thống: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Xuất báo cáo PDF với biểu đồ cho survey
     * GET /api/surveys/{surveyId}/results/export-pdf
     * Chỉ OWNER và ANALYST mới có quyền xem báo cáo (kiểm tra trong StatisticsService)
     */
    @GetMapping("/{surveyId}/results/export-pdf")
    @ApiMessage("Xuất báo cáo PDF với biểu đồ cho survey")
    public ResponseEntity<?> exportSurveyReportPDF(@PathVariable Long surveyId) {
        try {
            byte[] pdfBytes = statisticsService.exportSurveyReportPDF(surveyId);
            
            // Tạo filename với timestamp
            String timestamp = java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String filename = "survey_report_" + surveyId + "_" + timestamp + ".pdf";
            
            // Set headers
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.add(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, 
                "attachment; filename=\"" + filename + "\"; filename*=UTF-8''" + 
                java.net.URLEncoder.encode(filename, java.nio.charset.StandardCharsets.UTF_8));
            headers.add(org.springframework.http.HttpHeaders.CONTENT_TYPE, "application/pdf");
            
            return ResponseEntity.ok().headers(headers).body(pdfBytes);
        } catch (IdInvalidException e) {
            // Kiểm tra nếu lỗi liên quan đến quyền truy cập
            Map<String, String> errorResponse = new HashMap<>();
            if (e.getMessage() != null && e.getMessage().contains("quyền")) {
                errorResponse.put("message", e.getMessage());
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
            }
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi hệ thống khi xuất PDF: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

}
