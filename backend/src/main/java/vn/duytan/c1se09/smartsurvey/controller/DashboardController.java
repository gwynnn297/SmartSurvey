package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;

import java.util.HashMap;
import java.util.Map;

/**
 * REST Controller cho Dashboard
 */
@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    /**
     * Lấy tổng quan dashboard
     */
    @GetMapping("/overview")
    @ApiMessage("Get dashboard overview")
    public ResponseEntity<?> getDashboardOverview() {
        try {
            // Mock data - sau này sẽ thay bằng service thực
            Map<String, Object> overview = new HashMap<>();
            overview.put("totalSurveys", 0);
            overview.put("totalResponses", 0);
            overview.put("activeSurveys", 0);
            overview.put("completionRate", 0.0);

            return ResponseEntity.ok(overview);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi khi lấy thông tin dashboard: " + e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
}







