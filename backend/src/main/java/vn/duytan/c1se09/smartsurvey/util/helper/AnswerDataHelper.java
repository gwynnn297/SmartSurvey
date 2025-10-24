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
            return objectMapper.readValue(rankingOrderJson, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            log.error("Error deserializing ranking order: {}", e.getMessage());
            return null;
        }
    }
}