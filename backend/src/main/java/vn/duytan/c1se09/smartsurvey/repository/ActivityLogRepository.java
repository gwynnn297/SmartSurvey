package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.ActivityLog;
import vn.duytan.c1se09.smartsurvey.domain.User;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository cho ActivityLog entity
 */
@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    List<ActivityLog> findByUser(User user);

    List<ActivityLog> findByActionType(ActivityLog.ActionType actionType);

    List<ActivityLog> findByUserOrderByCreatedAtDesc(User user);

    List<ActivityLog> findByActionTypeOrderByCreatedAtDesc(ActivityLog.ActionType actionType);

    @Query("SELECT a FROM ActivityLog a WHERE a.createdAt BETWEEN :startDate AND :endDate")
    List<ActivityLog> findByDateRange(@Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    @Query("SELECT a FROM ActivityLog a WHERE a.user = :user AND a.createdAt BETWEEN :startDate AND :endDate")
    List<ActivityLog> findByUserAndDateRange(@Param("user") User user,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);
}