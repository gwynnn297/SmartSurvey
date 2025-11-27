package vn.duytan.c1se09.smartsurvey.domain.response.ai;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Response DTO for AI Chat
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiChatResponseDTO {

    @JsonProperty("chat_id")
    private Long chatId;

    @JsonProperty("survey_id")
    private Long surveyId;

    @JsonProperty("question_text")
    private String questionText;

    @JsonProperty("answer_text")
    private String answerText;

    private List<String> context;

    @JsonProperty("top_k")
    private Integer topK;

    @JsonProperty("created_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    // Factory methods
    public static AiChatResponseDTO success(Long chatId, Long surveyId, String questionText,
            String answerText, List<String> context, Integer topK,
            LocalDateTime createdAt) {
        return AiChatResponseDTO.builder()
                .chatId(chatId)
                .surveyId(surveyId)
                .questionText(questionText)
                .answerText(answerText)
                .context(context)
                .topK(topK)
                .createdAt(createdAt)
                .build();
    }
}