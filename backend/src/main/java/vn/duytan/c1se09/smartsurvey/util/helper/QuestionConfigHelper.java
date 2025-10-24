package vn.duytan.c1se09.smartsurvey.util.helper;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vn.duytan.c1se09.smartsurvey.domain.request.question.DateTimeQuestionConfigDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.question.FileUploadQuestionConfigDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.question.RankingQuestionConfigDTO;
import vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum;

@Component
@Slf4j
public class QuestionConfigHelper {
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    public String serializeQuestionConfig(QuestionTypeEnum questionType, Object config) {
        try {
            if (config == null) {
                return null;
            }
            return objectMapper.writeValueAsString(config);
        } catch (Exception e) {
            log.error("Error serializing question config for type {}: {}", questionType, e.getMessage());
            return null;
        }
    }
    
    public RankingQuestionConfigDTO deserializeRankingConfig(String configJson) {
        try {
            if (configJson == null || configJson.trim().isEmpty()) {
                return null;
            }
            return objectMapper.readValue(configJson, RankingQuestionConfigDTO.class);
        } catch (Exception e) {
            log.error("Error deserializing ranking config: {}", e.getMessage());
            return null;
        }
    }
    
    public FileUploadQuestionConfigDTO deserializeFileUploadConfig(String configJson) {
        try {
            if (configJson == null || configJson.trim().isEmpty()) {
                return null;
            }
            return objectMapper.readValue(configJson, FileUploadQuestionConfigDTO.class);
        } catch (Exception e) {
            log.error("Error deserializing file upload config: {}", e.getMessage());
            return null;
        }
    }
    
    public DateTimeQuestionConfigDTO deserializeDateTimeConfig(String configJson) {
        try {
            if (configJson == null || configJson.trim().isEmpty()) {
                return null;
            }
            return objectMapper.readValue(configJson, DateTimeQuestionConfigDTO.class);
        } catch (Exception e) {
            log.error("Error deserializing date time config: {}", e.getMessage());
            return null;
        }
    }
}