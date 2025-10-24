package vn.duytan.c1se09.smartsurvey.util.validator;

import org.springframework.stereotype.Component;
import vn.duytan.c1se09.smartsurvey.domain.request.question.DateTimeQuestionConfigDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.question.FileUploadQuestionConfigDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.question.QuestionCreateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.question.RankingQuestionConfigDTO;
import vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.List;

@Component
public class QuestionValidator {

    private static final List<String> ALLOWED_FILE_TYPES = Arrays.asList(
            "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
            "application/pdf", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain", "text/csv");

    private static final long MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    private static final int MAX_FILES_COUNT = 10;

    public void validateQuestionRequest(QuestionCreateRequestDTO request) throws IdInvalidException {
        QuestionTypeEnum type = request.getQuestionType();

        switch (type) {
            case ranking:
                validateRankingConfig(request.getRankingConfig());
                break;
            case file_upload:
                validateFileUploadConfig(request.getFileUploadConfig());
                break;
            case date_time:
                validateDateTimeConfig(request.getDateTimeConfig());
                break;
            default:
                // No additional validation needed for basic types
                break;
        }
    }

    private void validateRankingConfig(RankingQuestionConfigDTO config) throws IdInvalidException {
        if (config == null) {
            throw new IdInvalidException("Ranking configuration là bắt buộc cho câu hỏi xếp hạng");
        }

        if (config.getRankingOptions() == null || config.getRankingOptions().isEmpty()) {
            throw new IdInvalidException("Ranking options không được để trống");
        }

        if (config.getMaxRankings() == null || config.getMaxRankings() <= 0) {
            throw new IdInvalidException("Max rankings phải lớn hơn 0");
        }

        if (config.getMaxRankings() > config.getRankingOptions().size()) {
            throw new IdInvalidException("Max rankings không được lớn hơn số lượng options");
        }
    }

    private void validateFileUploadConfig(FileUploadQuestionConfigDTO config) throws IdInvalidException {
        if (config == null) {
            throw new IdInvalidException("File upload configuration là bắt buộc cho câu hỏi tải file");
        }

        if (config.getAllowedFileTypes() == null || config.getAllowedFileTypes().isEmpty()) {
            throw new IdInvalidException("Allowed file types không được để trống");
        }

        // Validate file types
        for (String fileType : config.getAllowedFileTypes()) {
            if (!ALLOWED_FILE_TYPES.contains(fileType.toLowerCase())) {
                throw new IdInvalidException("File type không được hỗ trợ: " + fileType);
            }
        }

        if (config.getMaxFileSize() == null || config.getMaxFileSize() <= 0) {
            throw new IdInvalidException("Max file size phải lớn hơn 0");
        }

        if (config.getMaxFileSize() > MAX_FILE_SIZE) {
            throw new IdInvalidException("Max file size không được lớn hơn " + (MAX_FILE_SIZE / 1024 / 1024) + "MB");
        }

        if (config.getMaxFiles() == null || config.getMaxFiles() <= 0) {
            throw new IdInvalidException("Max files phải lớn hơn 0");
        }

        if (config.getMaxFiles() > MAX_FILES_COUNT) {
            throw new IdInvalidException("Max files không được lớn hơn " + MAX_FILES_COUNT);
        }
    }

    private void validateDateTimeConfig(DateTimeQuestionConfigDTO config) throws IdInvalidException {
        if (config == null) {
            return; // DateTimeConfig is optional, will use defaults
        }

        // Validate date format
        if (config.getDateFormat() != null) {
            try {
                DateTimeFormatter.ofPattern(config.getDateFormat());
            } catch (IllegalArgumentException e) {
                throw new IdInvalidException("Date format không hợp lệ: " + config.getDateFormat());
            }
        }

        // Validate min/max dates
        if (config.getMinDate() != null && config.getMaxDate() != null) {
            try {
                LocalDate minDate = LocalDate.parse(config.getMinDate());
                LocalDate maxDate = LocalDate.parse(config.getMaxDate());

                if (minDate.isAfter(maxDate)) {
                    throw new IdInvalidException("Min date phải nhỏ hơn hoặc bằng max date");
                }
            } catch (DateTimeParseException e) {
                throw new IdInvalidException("Date format không hợp lệ. Sử dụng format yyyy-MM-dd");
            }
        }
    }
}