package vn.duytan.c1se09.smartsurvey.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vn.duytan.c1se09.smartsurvey.domain.ActivityLog;
import vn.duytan.c1se09.smartsurvey.domain.AiAnalysis;
import vn.duytan.c1se09.smartsurvey.domain.Response;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.dto.ai.SentimentAnalysisResponseDTO;
import vn.duytan.c1se09.smartsurvey.repository.AiAnalysisRepository;
import vn.duytan.c1se09.smartsurvey.repository.ResponseRepository;
import vn.duytan.c1se09.smartsurvey.repository.SurveyRepository;
import vn.duytan.c1se09.smartsurvey.service.ActivityLogService;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service cho AI Sentiment Analysis
 * Tích hợp với AI service của Thiện để phân tích cảm xúc
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiSentimentService {

    private final RestTemplate restTemplate;
    private final SurveyRepository surveyRepository;
    private final ResponseRepository responseRepository;
    private final AiAnalysisRepository aiAnalysisRepository;
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

            // 3. Gọi AI service của Thiện
            SentimentAnalysisResponseDTO aiResponse = callAiSentimentService(surveyId, questionId);

            if (!aiResponse.isSuccess()) {
                return aiResponse;
            }

            // 4. Lưu kết quả vào database
            AiAnalysis savedAnalysis = saveSentimentResult(surveyId, aiResponse);

            // 5. Log activity
            activityLogService.log(
                    ActivityLog.ActionType.ai_generate,
                    savedAnalysis.getAnalysisId(), 
                    "ai_analysis",
                    "Phân tích sentiment với Gemini API qua AI service");

            // 6. Update response với real ID
            aiResponse.setSentimentId(savedAnalysis.getAnalysisId());
            aiResponse.setCreatedAt(savedAnalysis.getCreatedAt());

            log.info("Hoàn thành phân tích sentiment với ID: {}", savedAnalysis.getAnalysisId());
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

            // 2. Tìm sentiment analysis gần nhất trong database
            List<AiAnalysis> sentimentAnalyses = aiAnalysisRepository.findBySurveyOrderByCreatedAtDesc(survey);
            AiAnalysis latestSentiment = sentimentAnalyses.stream()
                    .filter(analysis -> analysis.getAnalysisType() == AiAnalysis.AnalysisType.SENTIMENT)
                    .findFirst()
                    .orElse(null);

            if (latestSentiment != null) {
                // Parse từ database
                return parseSentimentFromDatabase(surveyId, latestSentiment);
            } else {
                // Nếu không có trong database, gọi AI service
                return callAiServiceGetSentiment(surveyId);
            }

        } catch (Exception e) {
            log.error("Lỗi khi lấy kết quả sentiment: {}", e.getMessage(), e);
            return SentimentAnalysisResponseDTO.error(surveyId,
                    "Lỗi khi lấy kết quả sentiment: " + e.getMessage());
        }
    }

    /**
     * Gọi AI service của Thiện để phân tích sentiment
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
                    url, HttpMethod.POST, httpEntity, new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {});

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> responseBody = response.getBody();
                log.info("Nhận phản hồi từ AI service: {}", responseBody);

                // Parse response từ AI service của Thiện
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
     * Gọi AI service để lấy kết quả sentiment gần nhất
     */
    private SentimentAnalysisResponseDTO callAiServiceGetSentiment(Long surveyId) {
        try {
            String url = aiServiceBaseUrl + "/ai/sentiment/" + surveyId;
            log.info("Gọi AI service để lấy kết quả: {}", url);

            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> responseBody = (Map<String, Object>) response.getBody();
                log.info("Nhận kết quả từ AI service: {}", responseBody);

                return parseAiServiceResponse(surveyId, responseBody);
            } else {
                return SentimentAnalysisResponseDTO.error(surveyId,
                        "Không tìm thấy kết quả sentiment");
            }

        } catch (Exception e) {
            log.error("Lỗi khi lấy kết quả sentiment từ AI service: {}", e.getMessage(), e);
            return SentimentAnalysisResponseDTO.error(surveyId,
                    "Lỗi khi lấy kết quả sentiment: " + e.getMessage());
        }
    }

    /**
     * Parse response từ AI service của Thiện
     */
    private SentimentAnalysisResponseDTO parseAiServiceResponse(Long surveyId, Map<String, Object> responseBody) {
        try {
            Object resultObj = responseBody.get("result");
            if (!(resultObj instanceof Map)) {
                return SentimentAnalysisResponseDTO.error(surveyId,
                        "AI service trả về response không đúng định dạng");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> result = (Map<String, Object>) resultObj;

            Integer totalResponses = (Integer) result.get("total_responses");
            Double positivePercent = ((Number) result.get("positive_percent")).doubleValue();
            Double neutralPercent = ((Number) result.get("neutral_percent")).doubleValue();
            Double negativePercent = ((Number) result.get("negative_percent")).doubleValue();

            // Parse counts từ details
            Map<String, Integer> counts = new HashMap<>();
            if (result.get("details") instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> details = (Map<String, Object>) result.get("details");
                if (details.get("counts") instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> countsMap = (Map<String, Object>) details.get("counts");
                    for (Map.Entry<String, Object> entry : countsMap.entrySet()) {
                        counts.put(entry.getKey(), ((Number) entry.getValue()).intValue());
                    }
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

            return SentimentAnalysisResponseDTO.success(surveyId, "Phân tích sentiment thành công",
                    totalResponses, positivePercent, neutralPercent, negativePercent,
                    counts, createdAt);

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
     * Lưu kết quả sentiment vào database
     */
    private AiAnalysis saveSentimentResult(Long surveyId, SentimentAnalysisResponseDTO aiResponse) {
        try {
            // Tạo JSON chứa toàn bộ thông tin sentiment
            Map<String, Object> sentimentData = new HashMap<>();
            sentimentData.put("total_responses", aiResponse.getTotalResponses());
            sentimentData.put("positive_percent", aiResponse.getPositivePercent());
            sentimentData.put("neutral_percent", aiResponse.getNeutralPercent());
            sentimentData.put("negative_percent", aiResponse.getNegativePercent());
            sentimentData.put("counts", aiResponse.getCounts());
            
            String analysisDataJson = objectMapper.writeValueAsString(sentimentData);

            // Tìm survey entity
            Survey survey = surveyRepository.findById(surveyId)
                    .orElseThrow(() -> new RuntimeException("Survey không tồn tại"));

            AiAnalysis analysis = new AiAnalysis();
            analysis.setSurvey(survey);
            analysis.setAnalysisType(AiAnalysis.AnalysisType.SENTIMENT);
            analysis.setAnalysisData(analysisDataJson);

            AiAnalysis savedAnalysis = aiAnalysisRepository.save(analysis);
            log.info("Đã lưu sentiment result với ID: {}", savedAnalysis.getAnalysisId());
            return savedAnalysis;

        } catch (Exception e) {
            log.error("Lỗi khi lưu sentiment result: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể lưu kết quả sentiment: " + e.getMessage());
        }
    }

    /**
     * Parse sentiment từ database (AiAnalysis entity)
     */
    private SentimentAnalysisResponseDTO parseSentimentFromDatabase(Long surveyId, AiAnalysis analysis) {
        try {
            // Parse JSON từ analysisData
            Map<String, Object> sentimentData = objectMapper.readValue(
                    analysis.getAnalysisData(), 
                    new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {}
            );

            Integer totalResponses = (Integer) sentimentData.get("total_responses");
            Double positivePercent = ((Number) sentimentData.get("positive_percent")).doubleValue();
            Double neutralPercent = ((Number) sentimentData.get("neutral_percent")).doubleValue();
            Double negativePercent = ((Number) sentimentData.get("negative_percent")).doubleValue();

            // Parse counts
            Map<String, Integer> counts = new HashMap<>();
            if (sentimentData.get("counts") instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> countsMap = (Map<String, Object>) sentimentData.get("counts");
                for (Map.Entry<String, Object> entry : countsMap.entrySet()) {
                    counts.put(entry.getKey(), ((Number) entry.getValue()).intValue());
                }
            }

            return SentimentAnalysisResponseDTO.success(surveyId, "Lấy kết quả sentiment từ database thành công",
                    totalResponses, positivePercent, neutralPercent, negativePercent,
                    counts, analysis.getCreatedAt());

        } catch (Exception e) {
            log.error("Lỗi khi parse sentiment từ database: {}", e.getMessage(), e);
            return SentimentAnalysisResponseDTO.error(surveyId,
                    "Lỗi khi xử lý dữ liệu sentiment từ database: " + e.getMessage());
        }
    }
}
