package vn.duytan.c1se09.smartsurvey.domain.response.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO cho phản hồi kiểm tra tính hợp lệ của prompt
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PromptValidationResponseDTO {

    /**
     * Kết quả kiểm tra (true nếu hợp lệ)
     */
    private Boolean valid;

    /**
     * Thông báo kết quả
     */
    private String message;

    /**
     * Timestamp kiểm tra
     */
    private Long timestamp;

    /**
     * Độ dài prompt
     */
    private Integer promptLength;

    /**
     * Ngôn ngữ được phát hiện (nếu có)
     */
    private String detectedLanguage;
}