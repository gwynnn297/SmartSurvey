package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;

import java.util.HashMap;
import java.util.Map;

/**
 * REST Controller cho Survey management
 */
@RestController
@RequestMapping("/surveys")
@RequiredArgsConstructor
public class SurveyController {

    /**
     * Lấy danh sách khảo sát với phân trang
     */
    @GetMapping
    @ApiMessage("Get surveys list")
    public ResponseEntity<?> getSurveys(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search) {
        try {
            // Mock data - sau này sẽ thay bằng service thực
            Map<String, Object> response = new HashMap<>();
            response.put("items", new Object[0]); // Empty array
            response.put("page", page);
            response.put("limit", limit);
            response.put("total", 0);
            response.put("totalPages", 0);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi khi lấy danh sách khảo sát: " + e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    /**
     * Tạo khảo sát mới
     */
    @PostMapping
    @ApiMessage("Create new survey")
    public ResponseEntity<?> createSurvey(@RequestBody Map<String, Object> surveyData) {
        try {
            // Mock response - sau này sẽ thay bằng service thực
            Map<String, Object> response = new HashMap<>();
            response.put("id", 1);
            response.put("title", surveyData.get("title"));
            response.put("status", "draft");
            response.put("message", "Khảo sát đã được tạo thành công");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "Lỗi khi tạo khảo sát: " + e.getMessage());
            errorResponse.put("status", "error");
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
}







