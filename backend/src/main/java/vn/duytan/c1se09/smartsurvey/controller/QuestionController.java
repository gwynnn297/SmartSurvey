package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.domain.request.question.QuestionCreateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.question.QuestionUpdateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.question.QuestionResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.question.QuestionCreateResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.question.QuestionUpdateResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.question.QuestionDeleteResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.QuestionService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import jakarta.validation.Valid;
import java.util.List;

/**
 * REST Controller cho Question management
 */
@RestController
@RequestMapping("/questions")
@RequiredArgsConstructor
public class QuestionController {
    private final QuestionService questionService;

    /**
     * Tạo câu hỏi mới
     */
    @PostMapping
    @ApiMessage("Create new question")
    public ResponseEntity<QuestionCreateResponseDTO> createQuestion(@Valid @RequestBody QuestionCreateRequestDTO request)
            throws IdInvalidException {
        var questionDTO = questionService.createQuestion(request);
        
        // Tạo response DTO riêng cho create
        QuestionCreateResponseDTO response = new QuestionCreateResponseDTO();
        response.setId(questionDTO.getId());
        response.setSurveyId(questionDTO.getSurveyId());
        response.setSurveyTitle(questionDTO.getSurveyTitle());
        response.setQuestionText(questionDTO.getQuestionText());
        response.setQuestionType(questionDTO.getQuestionType());
        response.setQuestionTypeDescription(questionDTO.getQuestionTypeDescription());
        response.setIsRequired(questionDTO.getIsRequired());
        response.setMessage("Tạo câu hỏi thành công!");
        response.setCreatedAt(questionDTO.getCreatedAt());
        response.setUpdatedAt(questionDTO.getUpdatedAt());
        
        return ResponseEntity.ok(response);
    }

    /**
     * Lấy danh sách câu hỏi theo survey
     */
    @GetMapping("/survey/{surveyId}")
    @ApiMessage("Get questions by survey")
    public ResponseEntity<List<QuestionResponseDTO>> getQuestionsBySurvey(@PathVariable("surveyId") Long surveyId) 
            throws IdInvalidException {
        var questions = questionService.getQuestionsBySurvey(surveyId);
        return ResponseEntity.ok(questions);
    }

    /**
     * Lấy chi tiết câu hỏi theo id
     */
    @GetMapping("/{id}")
    @ApiMessage("Get question detail")
    public ResponseEntity<QuestionResponseDTO> getQuestionDetail(@PathVariable("id") Long id) 
            throws IdInvalidException {
        var questionDTO = questionService.getQuestionById(id);
        return ResponseEntity.ok(questionDTO);
    }

    /**
     * Cập nhật câu hỏi
     */
    @PutMapping("/{id}")
    @ApiMessage("Update question")
    public ResponseEntity<QuestionUpdateResponseDTO> updateQuestion(@PathVariable("id") Long id,
            @Valid @RequestBody QuestionUpdateRequestDTO request) throws IdInvalidException {
        var updatedDTO = questionService.updateQuestion(id, request);
        
        // Tạo response DTO riêng cho update
        QuestionUpdateResponseDTO response = new QuestionUpdateResponseDTO();
        response.setId(updatedDTO.getId());
        response.setSurveyId(updatedDTO.getSurveyId());
        response.setSurveyTitle(updatedDTO.getSurveyTitle());
        response.setQuestionText(updatedDTO.getQuestionText());
        response.setQuestionType(updatedDTO.getQuestionType());
        response.setQuestionTypeDescription(updatedDTO.getQuestionTypeDescription());
        response.setIsRequired(updatedDTO.getIsRequired());
        response.setMessage("Cập nhật câu hỏi thành công!");
        response.setCreatedAt(updatedDTO.getCreatedAt());
        response.setUpdatedAt(updatedDTO.getUpdatedAt());
        
        return ResponseEntity.ok(response);
    }

    /**
     * Xóa câu hỏi
     */
    @DeleteMapping("/{id}")
    @ApiMessage("Delete question")
    public ResponseEntity<QuestionDeleteResponseDTO> deleteQuestion(@PathVariable("id") Long id) 
            throws IdInvalidException {
        questionService.deleteQuestion(id);
        QuestionDeleteResponseDTO response = new QuestionDeleteResponseDTO(id, "Xóa câu hỏi thành công");
        return ResponseEntity.ok(response);
    }
} 