package vn.duytan.c1se09.smartsurvey.domain.response.response;

import lombok.Data;

@Data
public class FileUploadResponseDTO {
    private Long fileId;
    private String fileName;
    private String originalFileName;
    private String fileType;
    private Long fileSize;
    private String fileUrl;
    private String uploadedAt;
}