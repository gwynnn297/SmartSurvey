package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.SurveyView;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository cho SurveyView entity
 */
@Repository
public interface SurveyViewRepository extends JpaRepository<SurveyView, Long> {
    
    /**
     * Đếm tổng số lượt xem của một survey
     */
    long countBySurvey(Survey survey);
    
    /**
     * Đếm số lượt xem duy nhất của một survey (theo IP address)
     */
    @Query("SELECT COUNT(DISTINCT sv.ipAddress) FROM SurveyView sv WHERE sv.survey = :survey")
    long countDistinctViewsBySurvey(@Param("survey") Survey survey);    
    
    /**
     * Đếm số lượt xem duy nhất của một survey trong khoảng thời gian
     */
    @Query("SELECT COUNT(DISTINCT sv.ipAddress) FROM SurveyView sv WHERE sv.survey = :survey AND sv.viewedAt >= :startDate")
    long countDistinctViewsBySurveySince(@Param("survey") Survey survey, @Param("startDate") LocalDateTime startDate);
    
    /**
     * Lấy danh sách views của một survey
     */
    List<SurveyView> findBySurveyOrderByViewedAtDesc(Survey survey);
    
    /**
     * Kiểm tra xem IP đã xem survey này chưa
     */
    boolean existsBySurveyAndIpAddress(Survey survey, String ipAddress);
    
    /**
     * Lấy view gần nhất của IP cho survey này
     */
    @Query("SELECT sv FROM SurveyView sv WHERE sv.survey = :survey AND sv.ipAddress = :ipAddress ORDER BY sv.viewedAt DESC")
    List<SurveyView> findLatestViewBySurveyAndIp(@Param("survey") Survey survey, @Param("ipAddress") String ipAddress);
}
