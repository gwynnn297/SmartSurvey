package vn.duytan.c1se09.smartsurvey.domain.response.survey;

import lombok.Data;
import java.util.List;

@Data
public class SurveyPaginationDTO {
    private Meta meta;
    private List<SurveyFetchResponseDTO> result;

    @Data
    public static class Meta {
        private int page;
        private int pageSize;
        private int pages;
        private long total;
    }
}
