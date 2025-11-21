package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.domain.Notification;
import vn.duytan.c1se09.smartsurvey.domain.response.notification.NotificationResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.AuthService;
import vn.duytan.c1se09.smartsurvey.service.NotificationService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.util.List;
import java.util.stream.Collectors;

/**
 * REST Controller cho Notification management
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final AuthService authService;

    /**
     * GET /api/notifications
     * Lấy danh sách notifications của user hiện tại
     */
    @GetMapping
    @ApiMessage("Get user notifications")
    public ResponseEntity<List<NotificationResponseDTO>> getNotifications() throws IdInvalidException {
        var currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }
        
        List<Notification> notifications = notificationService.getUserNotifications(currentUser);
        List<NotificationResponseDTO> dtos = notifications.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(dtos);
    }

    /**
     * GET /api/notifications/unread
     * Lấy danh sách notifications chưa đọc
     */
    @GetMapping("/unread")
    @ApiMessage("Get unread notifications")
    public ResponseEntity<List<NotificationResponseDTO>> getUnreadNotifications() throws IdInvalidException {
        var currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }
        
        List<Notification> notifications = notificationService.getUnreadNotifications(currentUser);
        List<NotificationResponseDTO> dtos = notifications.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(dtos);
    }

    /**
     * GET /api/notifications/unread/count
     * Đếm số notifications chưa đọc
     */
    @GetMapping("/unread/count")
    @ApiMessage("Get unread notifications count")
    public ResponseEntity<Long> getUnreadCount() throws IdInvalidException {
        var currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }
        
        long count = notificationService.getUnreadCount(currentUser);
        return ResponseEntity.ok(count);
    }

    /**
     * PUT /api/notifications/{notificationId}/read
     * Đánh dấu notification là đã đọc
     */
    @PutMapping("/{notificationId}/read")
    @ApiMessage("Mark notification as read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long notificationId) throws IdInvalidException {
        var currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new
          IdInvalidException("Người dùng chưa xác thực");
        }
        notificationService.markAsRead(notificationId, currentUser);
        return ResponseEntity.ok().build();
    }

    /**
     * PUT /api/notifications/read-all
     * Đánh dấu tất cả notifications là đã đọc
     */
    @PutMapping("/read-all")
    @ApiMessage("Mark all notifications as read")
    public ResponseEntity<Void> markAllAsRead() throws IdInvalidException {
        var currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new IdInvalidException("Người dùng chưa xác thực");
        }
        
        notificationService.markAllAsRead(currentUser);
        return ResponseEntity.ok().build();
    }

    private NotificationResponseDTO toDTO(Notification notification) {
        return NotificationResponseDTO.builder()
                .notificationId(notification.getNotificationId())
                .type(notification.getType().name())
                .title(notification.getTitle())
                .message(notification.getMessage())
                .relatedEntityType(notification.getRelatedEntityType())
                .relatedEntityId(notification.getRelatedEntityId())
                .isRead(notification.getIsRead())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}






















