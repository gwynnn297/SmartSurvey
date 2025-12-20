package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
    
    // NEW: Lấy lần login cuối của user
    @Query("SELECT a FROM ActivityLog a WHERE a.user = :user AND a.actionType = :actionType ORDER BY a.createdAt DESC")
    List<ActivityLog> findByUserAndActionTypeOrderByCreatedAtDesc(@Param("user") User user, 
                                                                    @Param("actionType") ActivityLog.ActionType actionType);
    
    // NEW: Query methods cho admin với pagination và filter
    @Query("""
        SELECT a FROM ActivityLog a
        WHERE (:userId IS NULL OR a.user.userId = :userId)
        AND (:actionType IS NULL OR a.actionType = :actionType)
        AND (:dateFrom IS NULL OR a.createdAt >= :dateFrom)
        AND (:dateTo IS NULL OR a.createdAt <= :dateTo)
        ORDER BY a.createdAt DESC
        """)
    Page<ActivityLog> findActivityLogsWithFilters(@Param("userId") Long userId,
                                                   @Param("actionType") ActivityLog.ActionType actionType,
                                                   @Param("dateFrom") LocalDateTime dateFrom,
                                                   @Param("dateTo") LocalDateTime dateTo,
                                                   Pageable pageable);
    
    // Query admin activities by action types
    @Query("""
        SELECT a FROM ActivityLog a
        WHERE a.actionType IN :actionTypes
        ORDER BY a.createdAt DESC
        """)
    Page<ActivityLog> findByActionTypeIn(@Param("actionTypes") List<ActivityLog.ActionType> actionTypes, Pageable pageable);
    
    // Query admin activities by user and action types
    @Query("""
        SELECT a FROM ActivityLog a
        WHERE a.targetId = :targetUserId
        AND a.actionType IN :actionTypes
        AND a.targetTable = 'users'
        ORDER BY a.createdAt DESC
        """)
    Page<ActivityLog> findByTargetUserAndActionTypeIn(@Param("targetUserId") Long targetUserId,
                                                       @Param("actionTypes") List<ActivityLog.ActionType> actionTypes,
                                                       Pageable pageable);
}