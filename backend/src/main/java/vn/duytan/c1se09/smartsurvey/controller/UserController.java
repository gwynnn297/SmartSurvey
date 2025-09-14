package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import vn.duytan.c1se09.smartsurvey.domain.request.UserRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.UserResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.UserService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;

/**
 * REST Controller cho User management
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * Tạo user mới
     * 
     * @param userRequest   DTO chứa thông tin user từ client
     * @param bindingResult Kết quả validation
     * @return ResponseEntity chứa thông tin user đã tạo hoặc lỗi
     */
    @PostMapping
    @ApiMessage("Create new user")
    public ResponseEntity<?> createUser(@Valid @RequestBody UserRequestDTO userRequest,
            BindingResult bindingResult) {
        // Bắt lỗi validation
        if (bindingResult.hasErrors()) {
            String errorMessage = bindingResult.getAllErrors().get(0).getDefaultMessage();
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", errorMessage);
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }

        try {
            UserResponseDTO createdUser = userService.createUser(userRequest);
            return ResponseEntity.status(HttpStatus.CREATED).body(createdUser);
        } catch (RuntimeException e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi hệ thống khi tạo user: " + e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }
}

