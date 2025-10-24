package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.duytan.c1se09.smartsurvey.domain.Answer;
import vn.duytan.c1se09.smartsurvey.domain.FileUpload;
import vn.duytan.c1se09.smartsurvey.domain.Response;
import vn.duytan.c1se09.smartsurvey.domain.response.response.FileUploadResponseDTO;
import vn.duytan.c1se09.smartsurvey.repository.AnswerRepository;
import vn.duytan.c1se09.smartsurvey.repository.FileUploadRepository;
import vn.duytan.c1se09.smartsurvey.repository.ResponseRepository;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FileUploadService {

    private final FileUploadRepository fileUploadRepository;
    private final AnswerRepository answerRepository;
    private final ResponseRepository responseRepository;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Value("${app.base.url:http://localhost:8080}")
    private String baseUrl;

    @Transactional
    public FileUploadResponseDTO uploadFile(Long answerId, MultipartFile file) throws IdInvalidException {
        // Validate answer exists
        Answer answer = answerRepository.findById(answerId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy answer"));

        // Validate file
        if (file.isEmpty()) {
            throw new IdInvalidException("File không được để trống");
        }

        try {
            // Create upload directory if not exists
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            // Generate unique filename
            String originalFileName = file.getOriginalFilename();
            String fileExtension = originalFileName != null && originalFileName.contains(".")
                    ? originalFileName.substring(originalFileName.lastIndexOf("."))
                    : "";
            String fileName = UUID.randomUUID().toString() + fileExtension;

            // Save file to disk
            Path filePath = uploadPath.resolve(fileName);
            Files.copy(file.getInputStream(), filePath);

            // Save file info to database
            FileUpload fileUpload = new FileUpload();
            fileUpload.setAnswer(answer);
            fileUpload.setFileName(fileName);
            fileUpload.setOriginalFileName(originalFileName);
            fileUpload.setFileType(file.getContentType());
            fileUpload.setFileSize(file.getSize());
            fileUpload.setFilePath(filePath.toString());

            FileUpload saved = fileUploadRepository.save(fileUpload);

            // Return response DTO
            return toFileUploadResponseDTO(saved);

        } catch (IOException e) {
            log.error("Error uploading file: {}", e.getMessage());
            throw new IdInvalidException("Lỗi khi upload file: " + e.getMessage());
        }
    }

    public List<FileUploadResponseDTO> getFileUploadsByResponse(Long responseId) throws IdInvalidException {
        Response response = responseRepository.findById(responseId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy response"));

        List<FileUpload> fileUploads = fileUploadRepository.findByAnswerResponse(response);
        return fileUploads.stream()
                .map(this::toFileUploadResponseDTO)
                .collect(Collectors.toList());
    }

    private FileUploadResponseDTO toFileUploadResponseDTO(FileUpload fileUpload) {
        FileUploadResponseDTO dto = new FileUploadResponseDTO();
        dto.setFileId(fileUpload.getFileId());
        dto.setFileName(fileUpload.getFileName());
        dto.setOriginalFileName(fileUpload.getOriginalFileName());
        dto.setFileType(fileUpload.getFileType());
        dto.setFileSize(fileUpload.getFileSize());
        dto.setFileUrl(baseUrl + "/api/files/" + fileUpload.getFileName());
        dto.setUploadedAt(fileUpload.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        return dto;
    }
}