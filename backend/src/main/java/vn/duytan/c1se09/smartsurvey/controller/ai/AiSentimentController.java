package vn.duytan.c1se09.smartsurvey.controller.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.dto.ai.SentimentAnalysisResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.ai.AiSentimentService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;

import java.security.Principal;

/**
 * Controller cho AI Sentiment Analysis
 */
@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class AiSentimentController {

    private final AiSentimentService aiSentimentService;

    /**
     * Phân tích sentiment cho survey
     * POST /ai/sentiment/{surveyId}
     */
    @PostMapping("/sentiment/{surveyId}")
    @ApiMessage("Phân tích sentiment cho survey")
    public ResponseEntity<SentimentAnalysisResponseDTO> analyzeSentiment(
            @PathVariable Long surveyId,
            @RequestParam(required = false) Long questionId,
            Principal principal) {

        log.info("Nhận yêu cầu phân tích sentiment cho survey: {}, question: {}, user: {}",
                surveyId, questionId, principal != null ? principal.getName() : "anonymous");

        try {
            SentimentAnalysisResponseDTO response = aiSentimentService.analyzeSentiment(surveyId, questionId);

            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
            }

        } catch (Exception e) {
            log.error("Error analyzing sentiment: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(SentimentAnalysisResponseDTO.error(surveyId,
                            "Lỗi hệ thống khi phân tích sentiment: " + e.getMessage()));
        }
    }

    /**
     * Lấy kết quả sentiment gần nhất
     * GET /ai/sentiment/{surveyId}
     */
    @GetMapping("/sentiment/{surveyId}")
    @ApiMessage("Lấy kết quả sentiment gần nhất")
    public ResponseEntity<SentimentAnalysisResponseDTO> getLatestSentiment(
            @PathVariable Long surveyId,
            Principal principal) {

        log.info("Nhận yêu cầu lấy kết quả sentiment cho survey: {}, user: {}",
                surveyId, principal != null ? principal.getName() : "anonymous");

        try {
            SentimentAnalysisResponseDTO response = aiSentimentService.getLatestSentiment(surveyId);

            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }

        } catch (Exception e) {
            log.error("Error getting sentiment: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(SentimentAnalysisResponseDTO.error(surveyId,
                            "Lỗi hệ thống khi lấy kết quả sentiment: " + e.getMessage()));
        }
    }

}
