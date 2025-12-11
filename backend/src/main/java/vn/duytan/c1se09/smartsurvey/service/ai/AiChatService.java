package vn.duytan.c1se09.smartsurvey.service.ai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vn.duytan.c1se09.smartsurvey.domain.AiChatLog;
import vn.duytan.c1se09.smartsurvey.domain.User;
import vn.duytan.c1se09.smartsurvey.domain.request.ai.AiChatRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.ai.AiChatResponseDTO;
import vn.duytan.c1se09.smartsurvey.repository.AiChatLogRepository;
import vn.duytan.c1se09.smartsurvey.service.UserService;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for AI Chat functionality
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiChatService {

    private final RestTemplate restTemplate;
    private final AiChatLogRepository aiChatLogRepository;
    private final UserService userService;
    private final ObjectMapper objectMapper;

    @Value("${ai.service.base-url:http://localhost:8000}")
    private String aiServiceBaseUrl;

    @Value("${ai.service.timeout:30000}")
    private int requestTimeout;

    /**
     * Process AI chat request
     */
    public AiChatResponseDTO processChat(AiChatRequestDTO request, String username) throws Exception {
        log.info("Processing AI chat for user: {} on survey: {}", username, request.getSurveyId());

        // Validate user exists
        User currentUser = null;
        if (username != null) {
            try {
                currentUser = userService.findUserByEmail(username);
                if (request.getUserId() == null && currentUser != null) {
                    request.setUserId(currentUser.getUserId());
                }
            } catch (Exception e) {
                log.warn("Could not find user: {}", username);
            }
        }

        // Call AI service
        Map<String, Object> aiRequest = createAiChatRequest(request);
        AiChatResponseDTO aiResponse = callAiChatService(aiRequest);

        // Save chat log to database
        AiChatLog chatLog = saveChatLog(request, aiResponse, currentUser);
        aiResponse.setChatId(chatLog.getChatId());

        log.info("AI chat processed successfully with chat_id: {}", chatLog.getChatId());
        return aiResponse;
    }

    /**
     * Get chat history for a survey
     */
    public List<AiChatLog> getChatHistory(Long surveyId, int limit) {
        if (limit > 100)
            limit = 100; // Safety limit
        return aiChatLogRepository.findLatestBySurveyId(surveyId, limit);
    }

    /**
     * Get chat history for a user on specific survey
     */
    public List<AiChatLog> getChatHistoryByUser(Long userId, Long surveyId) {
        return aiChatLogRepository.findByUserIdAndSurveyIdOrderByCreatedAtDesc(userId, surveyId);
    }

    /**
     * Ingest survey data for RAG
     */
    public Map<String, Object> ingestSurveyData(Long surveyId) throws Exception {
        log.info("Ingesting survey data for RAG: {}", surveyId);

        String url = aiServiceBaseUrl + "/ai/rag/ingest/" + surveyId;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, Map.class);

            @SuppressWarnings("unchecked")
            Map<String, Object> result = response.getBody();
            log.info("RAG ingest completed for survey {}: {}", surveyId, result);
            return result;

        } catch (Exception e) {
            log.error("Error ingesting survey data for RAG: {}", e.getMessage(), e);
            throw new Exception("Failed to ingest survey data: " + e.getMessage());
        }
    }

    private Map<String, Object> createAiChatRequest(AiChatRequestDTO request) {
        Map<String, Object> aiRequest = new HashMap<>();
        aiRequest.put("survey_id", request.getSurveyId());
        aiRequest.put("question_text", request.getQuestionText());
        aiRequest.put("user_id", request.getUserId());
        aiRequest.put("top_k", request.getTopK() != null ? request.getTopK() : 5);
        return aiRequest;
    }

    private AiChatResponseDTO callAiChatService(Map<String, Object> request) throws Exception {
        String url = aiServiceBaseUrl + "/ai/chat";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, Map.class);

            @SuppressWarnings("unchecked")
            Map<String, Object> responseBody = response.getBody();

            if (responseBody == null) {
                throw new Exception("Empty response from AI service");
            }

            // Parse response
            Long surveyId = Long.valueOf(responseBody.get("survey_id").toString());
            String questionText = (String) responseBody.get("question_text");
            String answerText = (String) responseBody.get("answer_text");
            Integer topK = Integer.valueOf(responseBody.get("top_k").toString());

            @SuppressWarnings("unchecked")
            List<String> context = (List<String>) responseBody.get("context");

            return AiChatResponseDTO.builder()
                    .surveyId(surveyId)
                    .questionText(questionText)
                    .answerText(answerText)
                    .context(context)
                    .topK(topK)
                    .createdAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("Error calling AI chat service: {}", e.getMessage(), e);
            throw new Exception("AI service unavailable: " + e.getMessage());
        }
    }

    private AiChatLog saveChatLog(AiChatRequestDTO request, AiChatResponseDTO response, User user) {
        try {
            String contextJson = null;
            if (response.getContext() != null && !response.getContext().isEmpty()) {
                contextJson = objectMapper.writeValueAsString(response.getContext());
            }

            AiChatLog chatLog = AiChatLog.builder()
                    .surveyId(request.getSurveyId())
                    .userId(user != null ? user.getUserId() : request.getUserId())
                    .questionText(request.getQuestionText())
                    .aiResponse(response.getAnswerText())
                    .context(contextJson)
                    .build();

            return aiChatLogRepository.save(chatLog);
        } catch (Exception e) {
            log.error("Error saving chat log: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save chat log: " + e.getMessage());
        }
    }
}