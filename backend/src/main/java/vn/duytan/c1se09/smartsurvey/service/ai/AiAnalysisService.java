package vn.duytan.c1se09.smartsurvey.service.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.User;
import vn.duytan.c1se09.smartsurvey.repository.SurveyRepository;
import vn.duytan.c1se09.smartsurvey.service.AuthService;
import vn.duytan.c1se09.smartsurvey.service.SurveyPermissionService;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyPermissionRole;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.util.Map;

/**
 * Service chịu trách nhiệm gọi AI Analysis Service thông qua RestTemplate
 */
@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("null")
public class AiAnalysisService {

    private final RestTemplate restTemplate;
    private final SurveyRepository surveyRepository;
    private final AuthService authService;
    private final SurveyPermissionService surveyPermissionService;

    @Value("${ai.sentiment.base-url:http://localhost:8000}")
    private String aiServiceBaseUrl;

    public Map<String, Object> extractKeywords(Long surveyId) throws IdInvalidException {
        validatePermission(surveyId);
        return postForSurvey("/ai/keywords/" + surveyId, surveyId);
    }

    public Map<String, Object> basicSentiment(Long surveyId) throws IdInvalidException {
        validatePermission(surveyId);
        return postForSurvey("/ai/basic-sentiment/" + surveyId, surveyId);
    }

    public Map<String, Object> summarize(Long surveyId) throws IdInvalidException {
        validatePermission(surveyId);
        return postForSurvey("/ai/summary/" + surveyId, surveyId);
    }

    public Map<String, Object> clusterThemes(Long surveyId, Integer k) throws IdInvalidException {
        validatePermission(surveyId);
        String path = "/ai/themes/" + surveyId + (k != null ? "?k=" + k : "");
        return postForSurvey(path, surveyId);
    }

    public Map<String, Object> getLatestAnalysis(Long surveyId, String kind) throws IdInvalidException {
        validatePermission(surveyId);
        return exchangeForSurvey("/ai/analysis/" + surveyId + "/latest/" + kind,
                HttpMethod.GET, surveyId);
    }

    /**
     * Kiểm tra user có quyền sử dụng AI analysis
     * CHỈ OWNER và ANALYST được phép sử dụng AI analysis
     * EDITOR và VIEWER không được phép
     */
    private void validatePermission(Long surveyId) throws IdInvalidException {
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
        
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }
        
        // Kiểm tra quyền: CHỈ OWNER và ANALYST được dùng AI
        var permission = surveyPermissionService.getUserPermission(survey, currentUser);
        if (permission == null) {
            throw new IdInvalidException("Bạn không có quyền truy cập khảo sát này");
        }
        
        // CHỈ OWNER và ANALYST được dùng AI (EDITOR và VIEWER không được)
        if (permission != SurveyPermissionRole.OWNER && permission != SurveyPermissionRole.ANALYST) {
            throw new IdInvalidException("Chỉ chủ sở hữu (OWNER) và phân tích viên (ANALYST) mới được phép sử dụng AI analysis. EDITOR và VIEWER không có quyền này.");
        }
    }

    private Map<String, Object> postForSurvey(String path, Long surveyId) {
        return exchangeForSurvey(path, HttpMethod.POST, surveyId);
    }

    private Map<String, Object> exchangeForSurvey(String path, HttpMethod method, Long surveyId) {
        String url = aiServiceBaseUrl + path;
        log.debug("Calling AI Analysis Service: {} {}", method, url);

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
        return responseBody;
    }
}
