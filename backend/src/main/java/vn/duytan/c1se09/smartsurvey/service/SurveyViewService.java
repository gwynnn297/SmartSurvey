package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.SurveyView;
import vn.duytan.c1se09.smartsurvey.repository.SurveyRepository;
import vn.duytan.c1se09.smartsurvey.repository.SurveyViewRepository;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Service xử lý việc track viewership của survey
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SurveyViewService {
    
    private final SurveyRepository surveyRepository;
    private final SurveyViewRepository surveyViewRepository;
    
    /**
     * Track một lượt xem survey
     * @param surveyId ID của survey
     * @param ipAddress IP address của người xem
     * @param userAgent User agent của browser
     * @param sessionId Session ID (có thể null)
     * @return SurveyView đã được tạo
     */
    @Transactional
    public SurveyView trackView(Long surveyId, String ipAddress, String userAgent, String sessionId) throws IdInvalidException {
        try {
            // Lấy survey
            Survey survey = surveyRepository.findById(surveyId)
                    .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
            
            // Tạo session ID nếu chưa có
            if (sessionId == null || sessionId.trim().isEmpty()) {
                sessionId = UUID.randomUUID().toString();
            }
            
            // Tạo view record
            SurveyView view = new SurveyView(survey, ipAddress, userAgent, sessionId);
            SurveyView savedView = surveyViewRepository.save(view);
            
            log.info("Tracked view for survey {} from IP {}", surveyId, ipAddress);
            return savedView;
            
        } catch (Exception e) {
            log.error("Error tracking view for survey {}: {}", surveyId, e.getMessage());
            throw e;
        }
    }
    
    /**
     * Track view với IP address và user agent từ request
     * @param surveyId ID của survey
     * @param ipAddress IP address
     * @param userAgent User agent
     * @return SurveyView đã được tạo
     */
    @Transactional
    public SurveyView trackView(Long surveyId, String ipAddress, String userAgent) throws IdInvalidException {
        return trackView(surveyId, ipAddress, userAgent, null);
    }
    
    /**
     * Lấy tổng số lượt xem của survey
     * @param surveyId ID của survey
     * @return Tổng số lượt xem
     */
    public long getTotalViews(Long surveyId) throws IdInvalidException {
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
        return surveyViewRepository.countBySurvey(survey);
    }
    
    /**
     * Lấy số lượt xem duy nhất của survey (theo IP)
     * @param surveyId ID của survey
     * @return Số lượt xem duy nhất
     */
    public long getUniqueViews(Long surveyId) throws IdInvalidException {
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
        return surveyViewRepository.countDistinctViewsBySurvey(survey);
    }
    
    /**
     * Lấy số lượt xem duy nhất trong khoảng thời gian
     * @param surveyId ID của survey
     * @param since Thời điểm bắt đầu
     * @return Số lượt xem duy nhất từ thời điểm đó
     */
    public long getUniqueViewsSince(Long surveyId, LocalDateTime since) throws IdInvalidException {
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
        return surveyViewRepository.countDistinctViewsBySurveySince(survey, since);
    }
    
    /**
     * Kiểm tra xem IP đã xem survey này chưa
     * @param surveyId ID của survey
     * @param ipAddress IP address
     * @return true nếu đã xem, false nếu chưa
     */
    public boolean hasViewed(Long surveyId, String ipAddress) throws IdInvalidException {
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
        return surveyViewRepository.existsBySurveyAndIpAddress(survey, ipAddress);
    }
}
