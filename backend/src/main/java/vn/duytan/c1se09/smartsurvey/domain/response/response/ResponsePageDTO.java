package vn.duytan.c1se09.smartsurvey.domain.response.response;

import lombok.Data;

import java.util.List;

@Data
public class ResponsePageDTO<T> {
    private Meta meta;
    private List<T> result;

    @Data
    public static class Meta {
        private int page;
        private int pageSize;
        private int pages;
        private long total;
    }
}


