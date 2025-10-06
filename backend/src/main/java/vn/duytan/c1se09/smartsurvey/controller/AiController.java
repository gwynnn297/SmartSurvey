package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.domain.request.ai.SentimentAnalysisRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.ai.SentimentAnalysisResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.AiService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

/**
 * Controller cho các API AI
 * Tích hợp với AI service để phân tích sentiment
 */
@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    /**
     * POST /ai/sentiment/{survey_id}
     * Trigger phân tích sentiment cho toàn bộ response của survey
     */
    @PostMapping("/sentiment/{surveyId}")
    @ApiMessage("Trigger sentiment analysis for survey")
    public ResponseEntity<SentimentAnalysisRequestDTO.TriggerResponse> triggerSentimentAnalysis(
            @PathVariable Long surveyId,
            @RequestParam(required = false) Long questionId) throws IdInvalidException {
        
        SentimentAnalysisRequestDTO.TriggerResponse response = 
            aiService.triggerSentimentAnalysis(surveyId, questionId);
        
        return ResponseEntity.ok(response);
    }

    /**
     * GET /ai/sentiment/{survey_id}
     * Lấy kết quả phân tích sentiment (phần trăm positive/neutral/negative)
     */
    @GetMapping("/sentiment/{surveyId}")
    @ApiMessage("Get sentiment analysis result for survey")
    public ResponseEntity<SentimentAnalysisResponseDTO.SimpleResponse> getSentimentResult(@PathVariable Long surveyId) throws IdInvalidException {
        
        SentimentAnalysisResponseDTO.SimpleResponse result = 
            aiService.getSentimentResult(surveyId);
        
        return ResponseEntity.ok(result);
    }

    /**
     * GET /ai/sentiment/{survey_id}/detailed
     * Lấy kết quả chi tiết từ database
     */
    @GetMapping("/sentiment/{surveyId}/detailed")
    @ApiMessage("Get detailed sentiment analysis result from database")
    public ResponseEntity<SentimentAnalysisResponseDTO> getDetailedSentimentResult(@PathVariable Long surveyId) throws IdInvalidException {
        
        SentimentAnalysisResponseDTO result = 
            aiService.getSentimentFromDatabase(surveyId);
        
        return ResponseEntity.ok(result);
    }
}
