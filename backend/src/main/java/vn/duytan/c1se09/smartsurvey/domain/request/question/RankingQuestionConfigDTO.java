package vn.duytan.c1se09.smartsurvey.domain.request.question;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class RankingQuestionConfigDTO {
    @NotEmpty(message = "Ranking options không được để trống")
    private List<String> rankingOptions;
    
    @NotNull(message = "Max rankings không được để trống")
    @Min(value = 1, message = "Max rankings phải lớn hơn 0")
    private Integer maxRankings;
}