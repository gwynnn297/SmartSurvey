package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import vn.duytan.c1se09.smartsurvey.domain.response.auth.AuthResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.AuthService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.domain.request.auth.LoginRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.auth.RegisterRequestDTO;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;

/**
 * REST Controller cho Authentication
 */
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor

public class AuthController {

    private final AuthService authService;

  @PostMapping("/register")
@ApiMessage("Register a new user")
public ResponseEntity<?> registerUser(@Valid @RequestBody RegisterRequestDTO registerRequest,
                                      BindingResult bindingResult) {
    // Bắt lỗi validation (ví dụ: mật khẩu < 6 ký tự)
    if (bindingResult.hasErrors()) {
        String errorMessage = bindingResult.getAllErrors().get(0).getDefaultMessage();
        Map<String, String> errorResponse = new HashMap<>();
        errorResponse.put("message", errorMessage);
        errorResponse.put("status", "error");
        return ResponseEntity.badRequest().body(errorResponse);
    }

    try {
        AuthResponseDTO authResponse = authService.registerUser(registerRequest);
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
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequestDTO loginRequest) {
        try {
            AuthResponseDTO authResponse = authService.authenticateUser(loginRequest);
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
    @PostMapping("/forgot-password")
@ApiMessage("Forgot password")
public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> req) {
    String email = req.get("email");

    // TODO: kiểm tra email có tồn tại không, nếu có thì tạo token reset, gửi mail reset
    // Tạm thời trả về message thành công để frontend test
    return ResponseEntity.ok(Map.of(
        "status", "success",
        "message", "Đã gửi email khôi phục mật khẩu cho " + email
    ));
}

}