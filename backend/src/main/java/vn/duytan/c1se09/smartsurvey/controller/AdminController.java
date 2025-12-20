package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.domain.response.UserResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.admin.*;
import vn.duytan.c1se09.smartsurvey.domain.request.UserRequestDTO;
import vn.duytan.c1se09.smartsurvey.service.AdminService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;
import jakarta.validation.Valid;

import java.time.LocalDateTime;

/**
 * REST Controller cho Admin management
 * Chỉ admin mới có quyền truy cập các endpoints này
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private final AdminService adminService;

    /**
     * Lấy dashboard tổng quan hệ thống
     * Endpoint: GET /api/admin/dashboard
     */
    @GetMapping("/dashboard")
    @ApiMessage("Get admin dashboard")
    public ResponseEntity<AdminDashboardDTO> getDashboard() throws IdInvalidException {
        return ResponseEntity.ok(adminService.getDashboard());
    }

    /**
     * Lấy danh sách users với phân trang và filter
     * Endpoint: GET /api/admin/users
     */
    @GetMapping("/users")
    @ApiMessage("Get users list (paginated)")
    public ResponseEntity<AdminUserPageDTO> getUsers(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "role", required = false) String role,
            @RequestParam(name = "isActive", required = false) Boolean isActive) throws IdInvalidException {
        return ResponseEntity.ok(adminService.getUsers(page, size, search, role, isActive));
    }

    /**
     * Tạo user mới
     * Endpoint: POST /api/admin/users
     */
    @PostMapping("/users")
    @ApiMessage("Create new user")
    public ResponseEntity<UserResponseDTO> createUser(@Valid @RequestBody UserRequestDTO requestDTO) throws IdInvalidException {
        return ResponseEntity.ok(adminService.createUser(requestDTO));
    }

    /**
     * Lấy chi tiết user
     * Endpoint: GET /api/admin/users/{userId}
     */
    @GetMapping("/users/{userId}")
    @ApiMessage("Get user detail")
    public ResponseEntity<AdminUserDetailDTO> getUserDetail(@PathVariable("userId") Long userId) throws IdInvalidException {
        return ResponseEntity.ok(adminService.getUserDetail(userId));
    }

    /**
     * Cập nhật thông tin user (fullName, role)
     * Endpoint: PUT /api/admin/users/{userId}
     */
    @PutMapping("/users/{userId}")
    @ApiMessage("Update user")
    public ResponseEntity<UserResponseDTO> updateUser(
            @PathVariable("userId") Long userId,
            @RequestParam(name = "fullName", required = false) String fullName,
            @RequestParam(name = "role", required = false) String role) throws IdInvalidException {
        return ResponseEntity.ok(adminService.updateUser(userId, fullName, role));
    }

    /**
     * Cập nhật trạng thái user (active/inactive)
     * Endpoint: PUT /api/admin/users/{userId}/status
     */
    @PutMapping("/users/{userId}/status")
    @ApiMessage("Update user status")
    public ResponseEntity<UserResponseDTO> updateUserStatus(
            @PathVariable("userId") Long userId,
            @RequestParam(name = "isActive") Boolean isActive) throws IdInvalidException {
        return ResponseEntity.ok(adminService.updateUserStatus(userId, isActive));
    }

    /**
     * Xóa user
     * Endpoint: DELETE /api/admin/users/{userId}
     */
    @DeleteMapping("/users/{userId}")
    @ApiMessage("Delete user")
    public ResponseEntity<Void> deleteUser(@PathVariable("userId") Long userId) throws IdInvalidException {
        adminService.deleteUser(userId);
        return ResponseEntity.ok().build();
    }

    /**
     * Lấy danh sách surveys với phân trang và filter
     * Endpoint: GET /api/admin/surveys
     */
    @GetMapping("/surveys")
    @ApiMessage("Get surveys list (paginated)")
    public ResponseEntity<AdminSurveyPageDTO> getSurveys(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "userId", required = false) Long userId,
            @RequestParam(name = "categoryId", required = false) Long categoryId,
            @RequestParam(name = "dateFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime dateFrom,
            @RequestParam(name = "dateTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime dateTo) throws IdInvalidException {
        return ResponseEntity.ok(adminService.getSurveys(page, size, search, status, userId, categoryId, dateFrom, dateTo));
    }

    /**
     * Lấy chi tiết survey
     * Endpoint: GET /api/admin/surveys/{surveyId}
     */
    @GetMapping("/surveys/{surveyId}")
    @ApiMessage("Get survey detail")
    public ResponseEntity<AdminSurveyDetailDTO> getSurveyDetail(@PathVariable("surveyId") Long surveyId) throws IdInvalidException {
        return ResponseEntity.ok(adminService.getSurveyDetail(surveyId));
    }

    /**
     * Cập nhật trạng thái survey (chỉ cho phép published hoặc archived)
     * Endpoint: PUT /api/admin/surveys/{surveyId}/status?status=published|archived
     */
    @PutMapping("/surveys/{surveyId}/status")
    @ApiMessage("Update survey status")
    public ResponseEntity<AdminSurveyDetailDTO> updateSurveyStatus(
            @PathVariable("surveyId") Long surveyId,
            @RequestParam(name = "status") String status) throws IdInvalidException {
        return ResponseEntity.ok(adminService.updateSurveyStatus(surveyId, status));
    }

    /**
     * Xóa survey
     * Endpoint: DELETE /api/admin/surveys/{surveyId}
     */
    @DeleteMapping("/surveys/{surveyId}")
    @ApiMessage("Delete survey")
    public ResponseEntity<Void> deleteSurvey(@PathVariable("surveyId") Long surveyId) throws IdInvalidException {
        adminService.deleteSurvey(surveyId);
        return ResponseEntity.ok().build();
    }

    /**
     * Lấy danh sách admin notifications (audit logs) - cho User history
     * Endpoint: GET /api/admin/notifications
     */
    @GetMapping("/notifications")
    @ApiMessage("Get admin notifications (audit logs)")
    public ResponseEntity<AdminNotificationPageDTO> getAdminNotifications(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "userId", required = false) Long userId,
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "isRead", required = false) Boolean isRead,
            @RequestParam(name = "dateFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime dateFrom,
            @RequestParam(name = "dateTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime dateTo) throws IdInvalidException {
        return ResponseEntity.ok(adminService.getAdminNotifications(page, size, userId, type, isRead, dateFrom, dateTo));
    }

    /**
     * Lấy danh sách activity logs - cho Survey history
     * Endpoint: GET /api/admin/activity-logs
     */
    @GetMapping("/activity-logs")
    @ApiMessage("Get activity logs (survey history)")
    public ResponseEntity<AdminActivityLogPageDTO> getActivityLogs(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "userId", required = false) Long userId,
            @RequestParam(name = "actionType", required = false) String actionType,
            @RequestParam(name = "dateFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime dateFrom,
            @RequestParam(name = "dateTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime dateTo) throws IdInvalidException {
        return ResponseEntity.ok(adminService.getActivityLogs(page, size, userId, actionType, dateFrom, dateTo));
    }
}


