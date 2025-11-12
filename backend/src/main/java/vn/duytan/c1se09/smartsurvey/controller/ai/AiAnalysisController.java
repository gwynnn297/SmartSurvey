package vn.duytan.c1se09.smartsurvey.controller.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.service.ai.AiAnalysisService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;

import java.security.Principal;
import java.util.Map;

/**
 * Controller proxy cho AI Analysis Service
 * Forward requests đến AI service (port 8000) từ backend (port 8080)
 */
@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class AiAnalysisController {

    private final AiAnalysisService aiAnalysisService;

    /**
     * POST /ai/keywords/{surveyId}
     * Trích xuất keywords từ responses
     */
    @PostMapping("/keywords/{surveyId}")
    @ApiMessage("Extract keywords from survey responses")
    public ResponseEntity<Map<String, Object>> extractKeywords(
            @PathVariable("surveyId") Long surveyId,
            Principal principal) {
        
        log.info("Extract keywords for survey: {}, user: {}", 
                surveyId, principal != null ? principal.getName() : "anonymous");
        
        try {
            Map<String, Object> response = aiAnalysisService.extractKeywords(surveyId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error extracting keywords: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("ok", false, "error", e.getMessage()));
        }
    }

    /**
     * POST /ai/basic-sentiment/{surveyId}
     * Phân tích sentiment cơ bản (batch)
     */
    @PostMapping("/basic-sentiment/{surveyId}")
    @ApiMessage("Basic sentiment analysis")
    public ResponseEntity<Map<String, Object>> basicSentiment(
            @PathVariable("surveyId") Long surveyId,
            Principal principal) {
        
        log.info("Basic sentiment analysis for survey: {}, user: {}", 
                surveyId, principal != null ? principal.getName() : "anonymous");
        
        try {
            Map<String, Object> response = aiAnalysisService.basicSentiment(surveyId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error in basic sentiment analysis: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("ok", false, "error", e.getMessage()));
        }
    }

    /**
     * POST /ai/summary/{surveyId}
     * Tóm tắt responses
     */
    @PostMapping("/summary/{surveyId}")
    @ApiMessage("Summarize survey responses")
    public ResponseEntity<Map<String, Object>> summarize(
            @PathVariable("surveyId") Long surveyId,
            Principal principal) {
        
        log.info("Summarize responses for survey: {}, user: {}", 
                surveyId, principal != null ? principal.getName() : "anonymous");
        
        try {
            Map<String, Object> response = aiAnalysisService.summarize(surveyId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error summarizing responses: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("ok", false, "error", e.getMessage()));
        }
    }

    /**
     * POST /ai/themes/{surveyId}
     * Phân cụm themes từ responses
     */
    @PostMapping("/themes/{surveyId}")
    @ApiMessage("Cluster themes from survey responses")
    public ResponseEntity<Map<String, Object>> clusterThemes(
            @PathVariable("surveyId") Long surveyId,
            @RequestParam(name = "k", required = false) Integer k,
            Principal principal) {
        
        log.info("Cluster themes for survey: {}, k: {}, user: {}", 
                surveyId, k, principal != null ? principal.getName() : "anonymous");
        
        try {
            Map<String, Object> response = aiAnalysisService.clusterThemes(surveyId, k);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error clustering themes: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("ok", false, "error", e.getMessage()));
        }
    }

    /**
     * GET /ai/analysis/{surveyId}/latest/{kind}
     * Lấy kết quả analysis gần nhất theo loại
     */
    @GetMapping("/analysis/{surveyId}/latest/{kind}")
    @ApiMessage("Get latest analysis by kind")
    public ResponseEntity<Map<String, Object>> getLatestAnalysis(
            @PathVariable("surveyId") Long surveyId,
            @PathVariable("kind") String kind,
            Principal principal) {
        
        log.info("Get latest analysis for survey: {}, kind: {}, user: {}", 
                surveyId, kind, principal != null ? principal.getName() : "anonymous");
        
        try {
            Map<String, Object> response = aiAnalysisService.getLatestAnalysis(surveyId, kind);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting latest analysis: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("ok", false, "error", e.getMessage()));
        }
    }
}

