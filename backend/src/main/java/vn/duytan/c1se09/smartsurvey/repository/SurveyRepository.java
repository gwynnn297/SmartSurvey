package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Survey;
import vn.duytan.c1se09.smartsurvey.domain.User;
import vn.duytan.c1se09.smartsurvey.domain.Category;
import vn.duytan.c1se09.smartsurvey.util.constant.SurveyStatusEnum;

import java.util.List;

/**
 * Repository cho Survey entity
 */
@Repository
public interface SurveyRepository extends JpaRepository<Survey, Long> {
    List<Survey> findByUser(User user);

    Page<Survey> findByUser(User user, Pageable pageable);

    List<Survey> findByStatus(SurveyStatusEnum status);

    List<Survey> findByCategory(Category category);

    List<Survey> findByUserAndStatus(User user, SurveyStatusEnum status);

    long countByUser(User user);

    long countByStatus(SurveyStatusEnum status);

    @Query("SELECT s FROM Survey s WHERE LOWER(s.title) LIKE LOWER(CONCAT('%', :title, '%'))")
    List<Survey> findByTitleContainingIgnoreCase(@Param("title") String title);

    /**
     * Tìm tất cả surveys mà user có quyền truy cập (owned + shared)
     * Bao gồm: surveys mà user là owner HOẶC có permission qua SurveyPermission
     */
    @Query("""
        SELECT DISTINCT s FROM Survey s
        LEFT JOIN SurveyPermission sp ON sp.survey = s AND sp.user = :user
        WHERE s.user = :user OR sp.survey IS NOT NULL
        ORDER BY s.createdAt DESC
        """)
    Page<Survey> findAccessibleSurveysByUser(@Param("user") User user, Pageable pageable);
    
    // NEW: Query methods cho admin với filtering và pagination
    @Query("""
        SELECT s FROM Survey s
        WHERE (:search IS NULL OR LOWER(s.title) LIKE LOWER(CONCAT('%', :search, '%')))
        AND (:status IS NULL OR s.status = :status)
        AND (:userId IS NULL OR s.user.userId = :userId)
        AND (:categoryId IS NULL OR s.category.categoryId = :categoryId)
        AND (:dateFrom IS NULL OR s.createdAt >= :dateFrom)
        AND (:dateTo IS NULL OR s.createdAt <= :dateTo)
        ORDER BY s.createdAt DESC
        """)
    Page<Survey> findSurveysWithFilters(@Param("search") String search,
                                        @Param("status") SurveyStatusEnum status,
                                        @Param("userId") Long userId,
                                        @Param("categoryId") Long categoryId,
                                        @Param("dateFrom") java.time.LocalDateTime dateFrom,
                                        @Param("dateTo") java.time.LocalDateTime dateTo,
                                        Pageable pageable);
}