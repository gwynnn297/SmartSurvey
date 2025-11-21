package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import vn.duytan.c1se09.smartsurvey.domain.request.UserRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.UserResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.dashboard.UserDashboardResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.UserService;
import vn.duytan.c1se09.smartsurvey.service.DashboardService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import jakarta.validation.Valid;

/**
 * REST Controller cho User management
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final DashboardService dashboardService;

    /**
     * Tạo user mới
     * 
     * @param userRequest   DTO chứa thông tin user từ client
     * @param bindingResult Kết quả validation
     * @return ResponseEntity chứa thông tin user đã tạo hoặc lỗi
     */
    @PostMapping
    @ApiMessage("Create new user")
    public ResponseEntity<UserResponseDTO> createUser(@Valid @RequestBody UserRequestDTO userRequest,
            BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            throw new RuntimeException(bindingResult.getAllErrors().get(0).getDefaultMessage());
        }
        UserResponseDTO createdUser = userService.createUser(userRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdUser);
    }

    /**
     * Lấy dashboard của user hiện tại
     * Endpoint: GET /api/users/me/dashboard
     */
    @GetMapping("/me/dashboard")
    @ApiMessage("Get user dashboard")
    public ResponseEntity<UserDashboardResponseDTO> getUserDashboard() throws IdInvalidException {
        UserDashboardResponseDTO dashboard = dashboardService.getUserDashboard();
        return ResponseEntity.ok(dashboard);
    }
}
