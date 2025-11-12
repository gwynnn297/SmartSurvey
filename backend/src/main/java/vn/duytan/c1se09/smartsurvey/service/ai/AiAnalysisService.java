package vn.duytan.c1se09.smartsurvey.service.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Service chịu trách nhiệm gọi AI Analysis Service thông qua RestTemplate
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiAnalysisService {

    private final RestTemplate restTemplate;

    @Value("${ai.sentiment.base-url:http://localhost:8000}")
    private String aiServiceBaseUrl;
    
    @jakarta.annotation.PostConstruct
    public void init() {
        log.info("=== AiAnalysisService Initialization ===");
        log.info("AI Service Base URL: {}", aiServiceBaseUrl);
        log.info("Working Directory: {}", System.getProperty("user.dir"));
        log.info("========================================");
    }

    public Map<String, Object> extractKeywords(Long surveyId) {
        return postForSurvey("/ai/keywords/" + surveyId, surveyId);
    }

    public Map<String, Object> basicSentiment(Long surveyId) {
        return postForSurvey("/ai/basic-sentiment/" + surveyId, surveyId);
    }

    public Map<String, Object> summarize(Long surveyId) {
        return postForSurvey("/ai/summary/" + surveyId, surveyId);
    }

    public Map<String, Object> clusterThemes(Long surveyId, Integer k) {
        String path = "/ai/themes/" + surveyId + (k != null ? "?k=" + k : "");
        return postForSurvey(path, surveyId);
    }

    public Map<String, Object> getLatestAnalysis(Long surveyId, String kind) {
        return exchangeForSurvey("/ai/analysis/" + surveyId + "/latest/" + kind,
                HttpMethod.GET, surveyId);
    }

    private Map<String, Object> postForSurvey(String path, Long surveyId) {
        return exchangeForSurvey(path, HttpMethod.POST, surveyId);
    }

    private Map<String, Object> exchangeForSurvey(String path, HttpMethod method, Long surveyId) {
        String url = aiServiceBaseUrl + path;
        log.info("Calling AI Analysis Service: {} {}", method, url);
        log.debug("Full URL: {}", url);
        log.debug("AI Service Base URL from config: {}", aiServiceBaseUrl);

        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    method,
                    null,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            Map<String, Object> responseBody = response.getBody();
            if (responseBody != null && surveyId != null && !responseBody.containsKey("survey_id")) {
                responseBody.put("survey_id", surveyId);
            }
            
            log.debug("AI Service response status: {}", response.getStatusCode());
            return responseBody != null ? responseBody : java.util.Map.of("ok", false, "error", "Empty response");
            
        } catch (org.springframework.web.client.ResourceAccessException e) {
            log.error("❌ Cannot connect to AI service at {}: {}", url, e.getMessage());
            log.error("Working Directory: {}", System.getProperty("user.dir"));
            log.error("AI Service Base URL: {}", aiServiceBaseUrl);
            return java.util.Map.of(
                "ok", false,
                "error", "Không thể kết nối đến AI service tại " + aiServiceBaseUrl + ". Vui lòng kiểm tra AI service có đang chạy không.",
                "survey_id", surveyId != null ? surveyId : 0,
                "details", e.getMessage()
            );
        } catch (org.springframework.web.client.HttpClientErrorException | org.springframework.web.client.HttpServerErrorException e) {
            log.error("❌ HTTP error when calling AI service {}: {} - {}", url, e.getStatusCode(), e.getResponseBodyAsString());
            return java.util.Map.of(
                "ok", false,
                "error", "AI service returned error: " + e.getStatusCode(),
                "survey_id", surveyId != null ? surveyId : 0,
                "details", e.getMessage()
            );
        } catch (Exception e) {
            log.error("❌ Unexpected error when calling AI service {}: {}", url, e.getMessage(), e);
            return java.util.Map.of(
                "ok", false,
                "error", "Lỗi khi gọi AI service: " + e.getMessage(),
                "survey_id", surveyId != null ? surveyId : 0
            );
        }
    }
}



