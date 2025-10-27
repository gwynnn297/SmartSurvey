package vn.duytan.c1se09.smartsurvey.domain.response.file;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class FileInfoDTO {
    private Long fileId;
    private String originalFileName;
    private String fileName;
    private String fileType;
    private Long fileSize;
    private String downloadUrl;
    private LocalDateTime uploadedAt;
}