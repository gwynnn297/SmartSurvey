package vn.duytan.c1se09.smartsurvey.domain.response.common;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ErrorDTO {
    private String message; // thông điệp chính (VN)
    private String error; // mã lỗi ngắn (ví dụ: BAD_REQUEST, NOT_FOUND)
    private int status; // HTTP status code
    private String path; // endpoint path (nếu có)
    private LocalDateTime timestamp; // thời điểm
}
