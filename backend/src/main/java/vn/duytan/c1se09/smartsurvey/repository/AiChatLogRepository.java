package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.AiChatLog;

import java.util.List;

/**
 * Repository for AI Chat Logs
 */
@Repository
public interface AiChatLogRepository extends JpaRepository<AiChatLog, Long> {

    /**
     * Find chat logs by survey ID, ordered by creation time descending
     */
    @Query("SELECT c FROM AiChatLog c WHERE c.surveyId = :surveyId ORDER BY c.createdAt DESC")
    List<AiChatLog> findBySurveyIdOrderByCreatedAtDesc(@Param("surveyId") Long surveyId);

    /**
     * Find chat logs by survey ID with pagination
     */
    @Query("SELECT c FROM AiChatLog c WHERE c.surveyId = :surveyId ORDER BY c.createdAt DESC")
    Page<AiChatLog> findBySurveyIdOrderByCreatedAtDesc(@Param("surveyId") Long surveyId, Pageable pageable);

    /**
     * Find chat logs by user ID and survey ID
     */
    @Query("SELECT c FROM AiChatLog c WHERE c.userId = :userId AND c.surveyId = :surveyId ORDER BY c.createdAt DESC")
    List<AiChatLog> findByUserIdAndSurveyIdOrderByCreatedAtDesc(@Param("userId") Long userId,
            @Param("surveyId") Long surveyId);

    /**
     * Count total chat interactions for a survey
     */
    @Query("SELECT COUNT(c) FROM AiChatLog c WHERE c.surveyId = :surveyId")
    Long countBySurveyId(@Param("surveyId") Long surveyId);

    /**
     * Find latest chat logs for a survey (limit)
     */
    @Query("SELECT c FROM AiChatLog c WHERE c.surveyId = :surveyId ORDER BY c.createdAt DESC LIMIT :limit")
    List<AiChatLog> findLatestBySurveyId(@Param("surveyId") Long surveyId, @Param("limit") int limit);
}