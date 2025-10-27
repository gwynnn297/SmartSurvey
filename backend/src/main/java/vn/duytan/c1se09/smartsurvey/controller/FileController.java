package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.domain.FileUpload;
import vn.duytan.c1se09.smartsurvey.domain.response.file.FileInfoDTO;
import vn.duytan.c1se09.smartsurvey.repository.FileUploadRepository;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Controller for file operations
 */
@RestController
@RequiredArgsConstructor
@Slf4j
public class FileController {

    private final FileUploadRepository fileUploadRepository;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    /**
     * Download uploaded file by file ID
     */
    @GetMapping("/api/files/download/{fileId}")
    @ApiMessage("Download uploaded file by ID")
    public ResponseEntity<Resource> downloadFileById(@PathVariable Long fileId) {
        try {
            // Get file info from database
            FileUpload fileUpload = fileUploadRepository.findById(fileId)
                    .orElse(null);

            if (fileUpload == null) {
                return ResponseEntity.notFound().build();
            }

            // Get file from filesystem
            Path filePath = Paths.get(fileUpload.getFilePath());
            if (!Files.exists(filePath) || !Files.isReadable(filePath)) {
                return ResponseEntity.notFound().build();
            }

            Resource resource = new FileSystemResource(filePath);

            // Determine content type
            String contentType = fileUpload.getFileType();
            if (contentType == null || contentType.trim().isEmpty()) {
                try {
                    contentType = Files.probeContentType(filePath);
                } catch (IOException e) {
                    contentType = "application/octet-stream";
                }
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + fileUpload.getOriginalFileName() + "\"")
                    .contentLength(fileUpload.getFileSize())
                    .body(resource);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get file info without downloading
     */
    @GetMapping("/api/files/info/{fileId}")
    @ApiMessage("Get file information")
    public ResponseEntity<FileInfoDTO> getFileInfo(@PathVariable Long fileId) {
        FileUpload fileUpload = fileUploadRepository.findById(fileId)
                .orElse(null);

        if (fileUpload == null) {
            return ResponseEntity.notFound().build();
        }

        // Map to DTO to avoid Hibernate proxy serialization issues
        FileInfoDTO fileInfo = new FileInfoDTO();
        fileInfo.setFileId(fileUpload.getFileId());
        fileInfo.setOriginalFileName(fileUpload.getOriginalFileName());
        fileInfo.setFileName(fileUpload.getFileName());
        fileInfo.setFileType(fileUpload.getFileType());
        fileInfo.setFileSize(fileUpload.getFileSize());
        fileInfo.setUploadedAt(fileUpload.getCreatedAt());
        fileInfo.setDownloadUrl("/api/files/download/" + fileUpload.getFileId());

        return ResponseEntity.ok(fileInfo);
    }

    /**
     * Download/View uploaded file
     */
    @GetMapping("/files/{filename}")
    @ApiMessage("Download file")
    public ResponseEntity<Resource> downloadFile(@PathVariable String filename) {
        try {
            Path filePath = Paths.get(uploadDir).resolve(filename).normalize();
            Resource resource = new UrlResource(filePath.toUri());

            if (resource.exists() && resource.isReadable()) {
                return ResponseEntity.ok()
                        .contentType(MediaType.APPLICATION_OCTET_STREAM)
                        .header(HttpHeaders.CONTENT_DISPOSITION,
                                "attachment; filename=\"" + resource.getFilename() + "\"")
                        .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * View file in browser
     */
    @GetMapping("/files/view/{filename}")
    @ApiMessage("View file")
    public ResponseEntity<Resource> viewFile(@PathVariable String filename) {
        try {
            Path filePath = Paths.get(uploadDir).resolve(filename).normalize();
            Resource resource = new UrlResource(filePath.toUri());

            if (resource.exists() && resource.isReadable()) {
                String contentType = determineContentType(filename);
                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                        .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private String determineContentType(String filename) {
        if (filename.toLowerCase().endsWith(".pdf")) {
            return "application/pdf";
        } else if (filename.toLowerCase().matches(".*\\.(jpg|jpeg)$")) {
            return "image/jpeg";
        } else if (filename.toLowerCase().endsWith(".png")) {
            return "image/png";
        } else if (filename.toLowerCase().endsWith(".gif")) {
            return "image/gif";
        } else {
            return "application/octet-stream";
        }
    }
}