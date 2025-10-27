package vn.duytan.c1se09.smartsurvey.util.helper;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Slf4j
public class AnswerDataHelper {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public String serializeRankingOrder(List<String> rankingOrder) {
        try {
            if (rankingOrder == null || rankingOrder.isEmpty()) {
                return null;
            }
            return objectMapper.writeValueAsString(rankingOrder);
        } catch (JsonProcessingException e) {
            log.error("Error serializing ranking order: {}", e.getMessage());
            return null;
        }
    }

    public List<String> deserializeRankingOrder(String rankingOrderJson) {
        try {
            if (rankingOrderJson == null || rankingOrderJson.trim().isEmpty()) {
                return null;
            }
            return objectMapper.readValue(rankingOrderJson, new TypeReference<List<String>>() {
            });
        } catch (JsonProcessingException e) {
            log.error("Error deserializing ranking order: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Serialize selected option IDs for multiple choice questions
     */
    public String serializeSelectedOptionIds(List<Long> optionIds) {
        try {
            if (optionIds == null || optionIds.isEmpty()) {
                return null;
            }
            return objectMapper.writeValueAsString(optionIds);
        } catch (JsonProcessingException e) {
            log.error("Error serializing selected option IDs: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Deserialize selected option IDs for multiple choice questions
     */
    public List<Long> deserializeSelectedOptionIds(String selectedOptionIdsJson) {
        try {
            if (selectedOptionIdsJson == null || selectedOptionIdsJson.trim().isEmpty()) {
                return null;
            }
            return objectMapper.readValue(selectedOptionIdsJson, new TypeReference<List<Long>>() {
            });
        } catch (JsonProcessingException e) {
            log.error("Error deserializing selected option IDs: {}", e.getMessage());
            return null;
        }
    }
}