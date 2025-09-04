package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.service.AuthService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.dto.auth.AuthResponse;
import vn.duytan.c1se09.smartsurvey.util.dto.auth.LoginRequest;
import vn.duytan.c1se09.smartsurvey.util.dto.auth.RegisterRequest;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;

/**
 * REST Controller cho Authentication
 */
@RestController
@RequestMapping("/auth")
@CrossOrigin(origins = "*", maxAge = 3600)
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @ApiMessage("Register a new user")
    public ResponseEntity<?> registerUser(@Valid @RequestBody RegisterRequest registerRequest) {
        try {
            AuthResponse authResponse = authService.registerUser(registerRequest);
            return ResponseEntity.ok(authResponse);
        } catch (RuntimeException e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    @PostMapping("/login")
    @ApiMessage("Login a user")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
        try {
            AuthResponse authResponse = authService.authenticateUser(loginRequest);
            return ResponseEntity.ok(authResponse);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Email hoặc mật khẩu không đúng");
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    @GetMapping("/me")
    @ApiMessage("Get current user")
    public ResponseEntity<?> getCurrentUser() {
        try {
            var currentUser = authService.getCurrentUser();
            if (currentUser == null) {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("message", "Không tìm thấy thông tin user");
                errorResponse.put("status", "error");
                return ResponseEntity.badRequest().body(errorResponse);
            }

            Map<String, Object> userInfo = new HashMap<>();
            userInfo.put("id", currentUser.getUserId());
            userInfo.put("email", currentUser.getEmail());
            userInfo.put("fullName", currentUser.getFullName());
            userInfo.put("role", currentUser.getRole().name());
            userInfo.put("isActive", currentUser.getIsActive());
            userInfo.put("createdAt", currentUser.getCreatedAt());

            return ResponseEntity.ok(userInfo);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi khi lấy thông tin user");
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    @GetMapping("/health")
    @ApiMessage("Health check")
    public ResponseEntity<?> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "OK");
        response.put("message", "SmartSurvey Auth Service is running");
        response.put("timestamp", String.valueOf(System.currentTimeMillis()));
        return ResponseEntity.ok(response);
    }
}