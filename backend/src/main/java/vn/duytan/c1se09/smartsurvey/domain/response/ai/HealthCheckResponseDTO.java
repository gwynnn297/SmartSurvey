package vn.duytan.c1se09.smartsurvey.domain.response.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO cho phản hồi kiểm tra trạng thái sức khỏe AI service
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HealthCheckResponseDTO {

    /**
     * Trạng thái service ("healthy" hoặc "unhealthy")
     */
    private String status;

    /**
     * Tên service
     */
    private String service;

    /**
     * Timestamp kiểm tra
     */
    private Long timestamp;

    /**
     * Thông báo bổ sung (nếu có)
     */
    private String message;
}