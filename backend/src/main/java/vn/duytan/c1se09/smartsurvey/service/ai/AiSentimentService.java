package vn.duytan.c1se09.smartsurvey.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vn.duytan.c1se09.smartsurvey.domain.ActivityLog;
import vn.duytan.c1se09.smartsurvey.domain.AiSentiment;
import vn.duytan.c1se09.smartsurvey.domain.Response;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.response.ai.SentimentAnalysisResponseDTO;
import vn.duytan.c1se09.smartsurvey.repository.AiSentimentRepository;
import vn.duytan.c1se09.smartsurvey.repository.ResponseRepository;
import vn.duytan.c1se09.smartsurvey.repository.SurveyRepository;
import vn.duytan.c1se09.smartsurvey.service.ActivityLogService;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * {@code @Service} cho AI Sentiment Analysis
 * Tích hợp với AI service để phân tích cảm xúc
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiSentimentService {

    private final RestTemplate restTemplate;
    private final SurveyRepository surveyRepository;
    private final ResponseRepository responseRepository;
    private final AiSentimentRepository aiSentimentRepository;
    private final ActivityLogService activityLogService;
    private final ObjectMapper objectMapper;

    @Value("${ai.sentiment.base-url:http://localhost:8000}")
    private String aiServiceBaseUrl;

    @Value("${ai.sentiment.timeout:30000}")
    private int requestTimeout;

    /**
     * Phân tích sentiment cho survey
     */
    public SentimentAnalysisResponseDTO analyzeSentiment(Long surveyId, Long questionId) {
        try {
            log.info("Bắt đầu phân tích sentiment cho survey: {}, question: {}", surveyId, questionId);

            // 1. Validate survey exists và có responses
            validateSurveyAndResponses(surveyId);

            // 2. Kiểm tra AI service health
            validateAiServiceHealth();

            // 3. Gọi AI service
            SentimentAnalysisResponseDTO aiResponse = callAiSentimentService(surveyId, questionId);

            if (!aiResponse.isSuccess()) {
                return aiResponse;
            }

            // 4. AI Service đã tạo record rồi, không cần tạo thêm
            // Chỉ log activity và trả về response
            if (aiResponse.getTotalResponses() != null && aiResponse.getTotalResponses() > 0) {
                log.info("AI service đã tạo sentiment record, không cần tạo thêm");

                // Log activity (không cần target_id vì không tạo record mới)
                activityLogService.log(
                        ActivityLog.ActionType.ai_generate,
                        null,
                        "ai_sentiment",
                        "Phân tích sentiment với Gemini API qua AI service");
            } else {
                log.warn("AI service trả về response rỗng");
            }

            log.info("Hoàn thành phân tích sentiment cho survey: {}", surveyId);
            return aiResponse;

        } catch (Exception e) {
            log.error("Lỗi khi phân tích sentiment: {}", e.getMessage(), e);
            return SentimentAnalysisResponseDTO.error(surveyId,
                    "Lỗi hệ thống khi phân tích sentiment: " + e.getMessage());
        }
    }

    /**
     * Lấy kết quả sentiment gần nhất
     */
    public SentimentAnalysisResponseDTO getLatestSentiment(Long surveyId) {
        try {
            log.info("Lấy kết quả sentiment gần nhất cho survey: {}", surveyId);

            // 1. Validate survey exists
            Survey survey = surveyRepository.findById(surveyId)
                    .orElseThrow(() -> new IllegalArgumentException("Survey không tồn tại"));

            // 2. Lấy từ bảng ai_sentiment
            List<AiSentiment> sentimentAnalyses = aiSentimentRepository.findBySurveyOrderByCreatedAtDesc(survey);
            AiSentiment latestSentiment = sentimentAnalyses.stream()
                    .findFirst()
                    .orElse(null);

            if (latestSentiment != null) {
                return parseSentimentFromDatabase(surveyId, latestSentiment);
            } else {
                log.info("Không tìm thấy sentiment cho survey: {}", surveyId);
                return SentimentAnalysisResponseDTO.error(surveyId, "Không tìm thấy kết quả sentiment");
            }

        } catch (Exception e) {
            log.error("Lỗi khi lấy kết quả sentiment: {}", e.getMessage(), e);
            return SentimentAnalysisResponseDTO.error(surveyId,
                    "Lỗi khi lấy kết quả sentiment: " + e.getMessage());
        }
    }

    /**
     * Gọi AI service để phân tích sentiment
     */
    private SentimentAnalysisResponseDTO callAiSentimentService(Long surveyId, Long questionId) {
        try {
            String url = aiServiceBaseUrl + "/ai/sentiment/" + surveyId;
            if (questionId != null) {
                url += "?question_id=" + questionId;
            }

            log.info("Gọi AI service: {}", url);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> httpEntity = new HttpEntity<>(headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url, HttpMethod.POST, httpEntity,
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {
                    });

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> responseBody = response.getBody();
                log.info("Nhận phản hồi từ AI service: {}", responseBody);

                // Parse response từ AI service
                return parseAiServiceResponse(surveyId, responseBody);
            } else {
                log.error("AI service trả về status không phải OK: {}", response.getStatusCode());
                return SentimentAnalysisResponseDTO.error(surveyId,
                        "AI service không phản hồi đúng định dạng");
            }

        } catch (Exception e) {
            log.error("Lỗi khi gọi AI sentiment service: {}", e.getMessage(), e);
            return SentimentAnalysisResponseDTO.error(surveyId,
                    "Không thể kết nối đến dịch vụ AI sentiment: " + e.getMessage());
        }
    }

    /**
     * Parse response từ AI service
     */
    private SentimentAnalysisResponseDTO parseAiServiceResponse(Long surveyId, Map<String, Object> responseBody) {
        try {
            // AI service trả về trực tiếp data
            Map<String, Object> result = responseBody;

            // Debug log để xem response format
            log.info("Debug - AI service response keys: {}", result.keySet());
            log.info("Debug - AI service response: {}", result);

            Integer totalResponses = (Integer) result.get("total_responses");
            Long sentimentId = null;

            // Parse sentiment_id từ AI service response
            if (result.get("sentiment_id") != null) {
                sentimentId = ((Number) result.get("sentiment_id")).longValue();
            }

            // Handle null values safely
            Double positivePercent = 0.0;
            Double neutralPercent = 0.0;
            Double negativePercent = 0.0;

            if (result.get("positive_percent") != null) {
                positivePercent = ((Number) result.get("positive_percent")).doubleValue();
            }
            if (result.get("neutral_percent") != null) {
                neutralPercent = ((Number) result.get("neutral_percent")).doubleValue();
            }
            if (result.get("negative_percent") != null) {
                negativePercent = ((Number) result.get("negative_percent")).doubleValue();
            }

            // Parse counts trực tiếp từ response
            Map<String, Integer> counts = new HashMap<>();
            if (result.get("counts") instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> countsMap = (Map<String, Object>) result.get("counts");
                for (Map.Entry<String, Object> entry : countsMap.entrySet()) {
                    counts.put(entry.getKey(), ((Number) entry.getValue()).intValue());
                }
            }

            // Parse created_at nếu có
            LocalDateTime createdAt = LocalDateTime.now();
            if (result.get("created_at") != null) {
                try {
                    createdAt = LocalDateTime.parse(result.get("created_at").toString());
                } catch (Exception e) {
                    log.warn("Không thể parse created_at: {}", e.getMessage());
                }
            }

            SentimentAnalysisResponseDTO response = SentimentAnalysisResponseDTO.success(surveyId,
                    "Phân tích sentiment thành công",
                    totalResponses, positivePercent, neutralPercent, negativePercent,
                    counts, createdAt);

            // Set sentiment_id từ AI service response
            response.setSentimentId(sentimentId);

            return response;

        } catch (Exception e) {
            log.error("Lỗi khi parse response từ AI service: {}", e.getMessage(), e);
            return SentimentAnalysisResponseDTO.error(surveyId,
                    "Lỗi khi xử lý phản hồi từ AI service: " + e.getMessage());
        }
    }

    /**
     * Validate survey và responses
     */
    private void validateSurveyAndResponses(Long surveyId) {
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IllegalArgumentException("Survey không tồn tại"));

        List<Response> responses = responseRepository.findBySurvey(survey);
        if (responses.isEmpty()) {
            throw new IllegalArgumentException("Survey không có responses để phân tích");
        }

        log.info("Survey {} có {} responses để phân tích", surveyId, responses.size());
    }

    /**
     * Kiểm tra AI service health
     */
    private void validateAiServiceHealth() {
        try {
            String healthUrl = aiServiceBaseUrl + "/health";
            ResponseEntity<String> response = restTemplate.getForEntity(healthUrl, String.class);
            if (response.getStatusCode() != HttpStatus.OK) {
                throw new RuntimeException("AI service không khả dụng");
            }
            log.info("AI service health check passed");
        } catch (Exception e) {
            log.error("AI service health check failed: {}", e.getMessage());
            throw new RuntimeException("Không thể kết nối đến AI service: " + e.getMessage());
        }
    }

    /**
     * Parse sentiment từ database (AiSentiment entity)
     */
    private SentimentAnalysisResponseDTO parseSentimentFromDatabase(Long surveyId, AiSentiment sentiment) {
        try {
            // Parse counts từ details JSON
            Map<String, Integer> counts = new HashMap<>();
            if (sentiment.getDetails() != null) {
                Map<String, Object> detailsData = objectMapper.readValue(
                        sentiment.getDetails(),
                        new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {
                        });

                if (detailsData.get("counts") instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> countsMap = (Map<String, Object>) detailsData.get("counts");
                    for (Map.Entry<String, Object> entry : countsMap.entrySet()) {
                        counts.put(entry.getKey(), ((Number) entry.getValue()).intValue());
                    }
                }
            }

            return SentimentAnalysisResponseDTO.builder()
                    .success(true)
                    .message("Lấy kết quả sentiment từ database thành công")
                    .surveyId(surveyId)
                    .sentimentId(sentiment.getSentimentId())
                    .totalResponses(sentiment.getTotalResponses())
                    .positivePercent(sentiment.getPositivePercent().doubleValue())
                    .neutralPercent(sentiment.getNeutralPercent().doubleValue())
                    .negativePercent(sentiment.getNegativePercent().doubleValue())
                    .counts(counts)
                    .createdAt(sentiment.getCreatedAt())
                    .build();

        } catch (Exception e) {
            log.error("Lỗi khi parse sentiment từ database: {}", e.getMessage(), e);
            return SentimentAnalysisResponseDTO.error(surveyId,
                    "Lỗi khi xử lý dữ liệu sentiment từ database: " + e.getMessage());
        }
    }



}
