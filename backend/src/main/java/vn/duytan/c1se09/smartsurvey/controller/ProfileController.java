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
    public ResponseEntity<Map<String, Object>> getProfile() {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("Không tìm thấy thông tin user");
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
    }

    /**
     * Cập nhật thông tin profile
     */
    @PutMapping("/profile")
    @ApiMessage("Update user profile")
    public ResponseEntity<Map<String, Object>> updateProfile(@Valid @RequestBody Map<String, String> updateData) {
        User currentUser = authService.getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("Không tìm thấy thông tin user");
        }
        if (updateData.containsKey("fullName")) {
            currentUser.setFullName(updateData.get("fullName"));
        }
        User savedUser = userService.updateUser(currentUser);
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Cập nhật profile thành công");
        response.put("userId", savedUser.getUserId());
        response.put("fullName", savedUser.getFullName());
        response.put("email", savedUser.getEmail());
        response.put("role", savedUser.getRole().name());
        return ResponseEntity.ok(response);
    }
}
