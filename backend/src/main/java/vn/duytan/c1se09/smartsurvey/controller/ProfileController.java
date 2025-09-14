package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import vn.duytan.c1se09.smartsurvey.service.AuthService;
import vn.duytan.c1se09.smartsurvey.service.UserService;
import vn.duytan.c1se09.smartsurvey.domain.User;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;

/**
 * REST Controller cho Profile management
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class ProfileController {

    private final AuthService authService;
    private final UserService userService;

    /**
     * Lấy thông tin profile của user hiện tại
     */
    @GetMapping("/profile")
    @ApiMessage("Get user profile")
    public ResponseEntity<?> getProfile() {
        try {
            User currentUser = authService.getCurrentUser();
            if (currentUser == null) {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("message", "Không tìm thấy thông tin user");
                errorResponse.put("status", "error");
                return ResponseEntity.badRequest().body(errorResponse);
            }

            Map<String, Object> profile = new HashMap<>();
            profile.put("userId", currentUser.getUserId());
            profile.put("fullName", currentUser.getFullName());
            profile.put("email", currentUser.getEmail());
            profile.put("role", currentUser.getRole().name());
            profile.put("isActive", currentUser.getIsActive());
            profile.put("createdAt", currentUser.getCreatedAt());
            profile.put("updatedAt", currentUser.getUpdatedAt());

            return ResponseEntity.ok(profile);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi khi lấy thông tin profile: " + e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    /**
     * Cập nhật thông tin profile
     */
    @PutMapping("/profile")
    @ApiMessage("Update user profile")
    public ResponseEntity<?> updateProfile(@Valid @RequestBody Map<String, String> updateData) {
        try {
            User currentUser = authService.getCurrentUser();
            if (currentUser == null) {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("message", "Không tìm thấy thông tin user");
                errorResponse.put("status", "error");
                return ResponseEntity.badRequest().body(errorResponse);
            }

            // Cập nhật full name nếu có
            if (updateData.containsKey("fullName")) {
                currentUser.setFullName(updateData.get("fullName"));
            }

            // Lưu lại user vào DB
            User savedUser = userService.updateUser(currentUser);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Cập nhật profile thành công");
            response.put("userId", savedUser.getUserId());
            response.put("fullName", savedUser.getFullName());
            response.put("email", savedUser.getEmail());
            response.put("role", savedUser.getRole().name());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi khi cập nhật profile: " + e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
}




