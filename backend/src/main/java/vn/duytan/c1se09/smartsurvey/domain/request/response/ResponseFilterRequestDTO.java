package vn.duytan.c1se09.smartsurvey.domain.request.response;

import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;

@Data
public class ResponseFilterRequestDTO {
    private Integer page = 0;
    private Integer size = 10;
    private String sort = "submittedAt,desc"; // field,dir

    private Long userId;
    private String requestToken;

    // completed | partial | dropped
    private String completionStatus;

    private String search; // search in answers

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime from;
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime to;
}


