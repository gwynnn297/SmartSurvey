package vn.duytan.c1se09.smartsurvey.domain.request.ai;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for AI Chat
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiChatRequestDTO {

    @NotNull(message = "Survey ID không được để trống")
    private Long surveyId;

    @NotNull(message = "Câu hỏi không được để trống")
    @Size(min = 1, max = 1000, message = "Câu hỏi phải có độ dài từ 1 đến 1000 ký tự")
    private String questionText;

    private Long userId;

    @Builder.Default
    private Integer topK = 5;
}