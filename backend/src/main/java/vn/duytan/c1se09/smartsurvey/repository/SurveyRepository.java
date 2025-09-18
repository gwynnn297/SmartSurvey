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
}