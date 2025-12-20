package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Notification;
import vn.duytan.c1se09.smartsurvey.domain.User;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository cho Notification entity
 */
@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    
    List<Notification> findByUserOrderByCreatedAtDesc(User user);
    
    List<Notification> findByUserAndIsReadFalseOrderByCreatedAtDesc(User user);
    
    long countByUserAndIsReadFalse(User user);
    
    // Note: @Modifying query for UPDATE operations
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE Notification n SET n.isRead = true WHERE n.user = :user AND n.isRead = false")
    void markAllAsRead(@Param("user") User user);
    
    // NEW: Query methods cho admin audit logs
    @Query("SELECT n FROM Notification n WHERE n.type IN :types ORDER BY n.createdAt DESC")
    Page<Notification> findByTypeIn(@Param("types") List<Notification.NotificationType> types, Pageable pageable);
    
    @Query("SELECT n FROM Notification n WHERE n.user = :user AND n.type IN :types ORDER BY n.createdAt DESC")
    Page<Notification> findByUserAndTypeIn(@Param("user") User user, 
                                          @Param("types") List<Notification.NotificationType> types, 
                                          Pageable pageable);
    
    @Query("SELECT n FROM Notification n WHERE n.type LIKE 'ADMIN_%' ORDER BY n.createdAt DESC")
    Page<Notification> findAdminNotifications(Pageable pageable);
    
    @Query("SELECT n FROM Notification n WHERE n.user = :user AND n.type LIKE 'ADMIN_%' ORDER BY n.createdAt DESC")
    Page<Notification> findAdminNotificationsByUser(@Param("user") User user, Pageable pageable);
    
    @Query("SELECT n FROM Notification n WHERE n.type = :type ORDER BY n.createdAt DESC")
    Page<Notification> findByType(@Param("type") Notification.NotificationType type, Pageable pageable);
    
    @Query("SELECT n FROM Notification n WHERE n.createdAt BETWEEN :fromDate AND :toDate AND n.type LIKE 'ADMIN_%' ORDER BY n.createdAt DESC")
    Page<Notification> findAdminNotificationsByDateRange(@Param("fromDate") LocalDateTime fromDate, 
                                                         @Param("toDate") LocalDateTime toDate, 
                                                         Pageable pageable);
    
    // NEW: Query với filter type và isRead
    @Query("""
        SELECT n FROM Notification n 
        WHERE n.type LIKE 'ADMIN_%'
        AND (:userId IS NULL OR n.user.userId = :userId)
        AND (:type IS NULL OR n.type = :type)
        AND (:isRead IS NULL OR n.isRead = :isRead)
        AND (:dateFrom IS NULL OR n.createdAt >= :dateFrom)
        AND (:dateTo IS NULL OR n.createdAt <= :dateTo)
        ORDER BY n.createdAt DESC
        """)
    Page<Notification> findAdminNotificationsWithFilters(@Param("userId") Long userId,
                                                         @Param("type") Notification.NotificationType type,
                                                         @Param("isRead") Boolean isRead,
                                                         @Param("dateFrom") LocalDateTime dateFrom,
                                                         @Param("dateTo") LocalDateTime dateTo,
                                                         Pageable pageable);
}

