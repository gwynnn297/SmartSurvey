package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vn.duytan.c1se09.smartsurvey.domain.AiSentiment;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.request.ai.SentimentAnalysisRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.ai.SentimentAnalysisResponseDTO;
import vn.duytan.c1se09.smartsurvey.repository.AiSentimentRepository;
import vn.duytan.c1se09.smartsurvey.repository.SurveyRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * Service tích hợp với AI service để phân tích sentiment
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiService {

    private final RestTemplate restTemplate;
    private final AiSentimentRepository aiSentimentRepository;
    private final SurveyRepository surveyRepository;

    @Value("${ai.service.base-url:http://localhost:8000}")
    private String aiServiceBaseUrl;

    /**
     * Trigger phân tích sentiment cho survey
     */
    public SentimentAnalysisRequestDTO.TriggerResponse triggerSentimentAnalysis(Long surveyId, Long questionId) {
        // Kiểm tra survey tồn tại
        Optional<Survey> surveyOpt = surveyRepository.findById(surveyId);
        if (surveyOpt.isEmpty()) {
            throw new RuntimeException("Survey không tồn tại: " + surveyId);
        }

        // Gọi AI service
        String url = aiServiceBaseUrl + "/ai/sentiment/" + surveyId;
        if (questionId != null) {
            url += "?question_id=" + questionId;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        log.info("Gọi AI service: {}", url);
        ResponseEntity<Map> response = restTemplate.exchange(
            url, HttpMethod.POST, entity, Map.class
        );

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            Map<String, Object> body = response.getBody();
            
            return SentimentAnalysisRequestDTO.TriggerResponse.builder()
                .surveyId(surveyId)
                .result(Long.valueOf(body.get("result").toString()))
                .createdAt(body.get("created_at").toString())
                .status("SUCCESS")
                .message("Phân tích sentiment thành công")
                .build();
        } else {
            throw new RuntimeException("AI service trả về lỗi: " + response.getStatusCode());
        }
    }

    /**
     * Lấy kết quả sentiment từ AI service hoặc database
     */
    public SentimentAnalysisResponseDTO.SimpleResponse getSentimentResult(Long surveyId) {
        // Thử lấy từ database local trước
        Optional<AiSentiment> aiSentimentOpt = aiSentimentRepository.findLatestBySurveyId(surveyId);
        
        if (aiSentimentOpt.isPresent()) {
            AiSentiment aiSentiment = aiSentimentOpt.get();
            return SentimentAnalysisResponseDTO.SimpleResponse.builder()
                .surveyId(surveyId)
                .positivePercent(aiSentiment.getPositivePercent())
                .neutralPercent(aiSentiment.getNeutralPercent())
                .negativePercent(aiSentiment.getNegativePercent())
                .sampleSize(aiSentiment.getTotalResponses())
                .generatedAt(aiSentiment.getCreatedAt())
                .build();
        }
        
        // Nếu không có trong DB, thử lấy từ AI service
        String url = aiServiceBaseUrl + "/ai/sentiment/" + surveyId;
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        log.info("Lấy kết quả sentiment từ AI service: {}", url);
        ResponseEntity<Map> response = restTemplate.exchange(
            url, HttpMethod.GET, entity, Map.class
        );

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            Map<String, Object> body = response.getBody();
            Map<String, Object> result = (Map<String, Object>) body.get("result");
            
            return SentimentAnalysisResponseDTO.SimpleResponse.builder()
                .surveyId(surveyId)
                .positivePercent(new BigDecimal(result.get("positive_percent").toString()))
                .neutralPercent(new BigDecimal(result.get("neutral_percent").toString()))
                .negativePercent(new BigDecimal(result.get("negative_percent").toString()))
                .sampleSize(Integer.valueOf(result.get("total_responses").toString()))
                .generatedAt(LocalDateTime.parse(result.get("created_at").toString().replace("Z", "")))
                .build();
        } else {
            throw new RuntimeException("AI service trả về lỗi: " + response.getStatusCode());
        }
    }

    /**
     * Lấy kết quả sentiment từ database local
     */
    public SentimentAnalysisResponseDTO getSentimentFromDatabase(Long surveyId) {
        Optional<AiSentiment> aiSentimentOpt = aiSentimentRepository.findLatestBySurveyId(surveyId);
        
        if (aiSentimentOpt.isPresent()) {
            AiSentiment aiSentiment = aiSentimentOpt.get();
            return SentimentAnalysisResponseDTO.builder()
                .surveyId(surveyId)
                .sentimentId(aiSentiment.getSentimentId())
                .totalResponses(aiSentiment.getTotalResponses())
                .positivePercent(aiSentiment.getPositivePercent())
                .neutralPercent(aiSentiment.getNeutralPercent())
                .negativePercent(aiSentiment.getNegativePercent())
                .details(aiSentiment.getDetails())
                .createdAt(aiSentiment.getCreatedAt())
                .updatedAt(aiSentiment.getUpdatedAt())
                .build();
        }
        
        throw new RuntimeException("Không tìm thấy kết quả sentiment cho survey: " + surveyId);
    }
}
