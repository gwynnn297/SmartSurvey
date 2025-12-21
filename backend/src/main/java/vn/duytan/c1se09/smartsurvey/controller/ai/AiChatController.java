package vn.duytan.c1se09.smartsurvey.controller.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.domain.AiChatLog;
import vn.duytan.c1se09.smartsurvey.domain.request.ai.AiChatRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.ai.AiChatResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.ai.AiChatService;

import jakarta.validation.Valid;
import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller for AI Chat/RAG functionality
 */
@RestController
@RequestMapping("/ai/chat")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class AiChatController {

    private final AiChatService aiChatService;

    /**
     * Process chat with AI based on survey data
     * 
     * @param request   Chat request with question and survey context
     * @param principal User principal from JWT
     * @return AI response with context
     */
    @PostMapping
    public ResponseEntity<AiChatResponseDTO> processChat(
            @Valid @RequestBody AiChatRequestDTO request,
            Principal principal) {

        log.info("Received AI chat request for survey: {}", request.getSurveyId());

        try {
            String username = principal != null ? principal.getName() : null;
            AiChatResponseDTO response = aiChatService.processChat(request, username);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error processing AI chat: {}", e.getMessage(), e);

            AiChatResponseDTO errorResponse = AiChatResponseDTO.builder()
                    .surveyId(request.getSurveyId())
                    .questionText(request.getQuestionText())
                    .answerText("Xin lỗi, hiện tại không thể xử lý câu hỏi của bạn. Vui lòng thử lại sau.")
                    .build();

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(errorResponse);
        }
    }

    /**
     * Get chat history for a survey
     * 
     * @param surveyId Survey ID
     * @param limit    Maximum number of chat logs to return (default: 20, max: 100)
     * @return List of chat history
     */
    @GetMapping("/history/{surveyId}")
    public ResponseEntity<Map<String, Object>> getChatHistory(
            @PathVariable Long surveyId,
            @RequestParam(defaultValue = "20") int limit) {

        try {
            List<AiChatLog> chatHistory = aiChatService.getChatHistory(surveyId, limit);

            Map<String, Object> response = new HashMap<>();
            response.put("survey_id", surveyId);
            response.put("chat_history", chatHistory);
            response.put("total", chatHistory.size());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error retrieving chat history for survey {}: {}", surveyId, e.getMessage());

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Failed to retrieve chat history");
            errorResponse.put("message", e.getMessage());

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(errorResponse);
        }
    }

    /**
     * Get user's chat history for a specific survey
     * 
     * @param surveyId Survey ID
     * @param userId   User ID
     * @return List of user's chat history
     */
    @GetMapping("/history/{surveyId}/user/{userId}")
    public ResponseEntity<Map<String, Object>> getUserChatHistory(
            @PathVariable Long surveyId,
            @PathVariable Long userId) {

        try {
            List<AiChatLog> chatHistory = aiChatService.getChatHistoryByUser(userId, surveyId);

            Map<String, Object> response = new HashMap<>();
            response.put("survey_id", surveyId);
            response.put("user_id", userId);
            response.put("chat_history", chatHistory);
            response.put("total", chatHistory.size());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error retrieving user chat history for survey {} user {}: {}",
                    surveyId, userId, e.getMessage());

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Failed to retrieve user chat history");
            errorResponse.put("message", e.getMessage());

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(errorResponse);
        }
    }

    /**
     * Ingest survey data into RAG system
     * 
     * @param surveyId Survey ID to ingest
     * @return Ingestion result
     */
    @PostMapping("/rag/ingest/{surveyId}")
    public ResponseEntity<Map<String, Object>> ingestSurveyData(@PathVariable Long surveyId) {

        log.info("Starting RAG ingest for survey: {}", surveyId);

        try {
            Map<String, Object> result = aiChatService.ingestSurveyData(surveyId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("survey_id", surveyId);
            response.put("result", result);
            response.put("message", "Survey data ingested successfully for RAG");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error ingesting survey data for RAG: {}", e.getMessage(), e);

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("survey_id", surveyId);
            errorResponse.put("error", "Failed to ingest survey data");
            errorResponse.put("message", e.getMessage());

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(errorResponse);
        }
    }

    /**
     * Health check for AI Chat service
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> response = new HashMap<>();
        response.put("service", "ai-chat");
        response.put("status", "healthy");
        response.put("timestamp", System.currentTimeMillis());

        return ResponseEntity.ok(response);
    }
}