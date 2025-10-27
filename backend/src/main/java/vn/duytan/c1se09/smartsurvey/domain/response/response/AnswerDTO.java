package vn.duytan.c1se09.smartsurvey.domain.response.response;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class AnswerDTO {
    private Long answerId;
    private Long questionId;
    private Long optionId; // For single choice
    private List<Long> selectedOptionIds; // For multiple choice - always IDs for consistent API
    private String answerText;
    private LocalDateTime createdAt;
    private String questionText;

    // For ranking questions
    private List<String> rankingOrder; // Legacy format - for backward compatibility
    private List<Long> rankingOptionIds; // New format - option IDs in ranking order

    // For date/time questions
    private String dateValue;
    private String timeValue;

    // For file upload questions
    private List<FileUploadInfo> uploadedFiles;

    @Data
    public static class FileUploadInfo {
        private Long fileId;
        private String originalFileName;
        private String fileName;
        private String fileType;
        private Long fileSize;
        private String downloadUrl;
        private LocalDateTime uploadedAt;
    }
}