package vn.duytan.c1se09.smartsurvey.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.duytan.c1se09.smartsurvey.domain.request.question.QuestionCreateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.question.QuestionUpdateRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.question.QuestionReorderRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.question.QuestionResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.question.QuestionCreateResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.question.QuestionUpdateResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.question.QuestionDeleteResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.question.QuestionReorderResponseDTO;
import vn.duytan.c1se09.smartsurvey.service.QuestionService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;
import jakarta.validation.Valid;
import java.util.List;

/**
 * REST Controller cho Question management
 */
@RestController
@RequiredArgsConstructor
public class QuestionController {
    private final QuestionService questionService;

    /**
     * Tạo câu hỏi cho survey cụ thể
     */
    @PostMapping("/surveys/{surveyId}/questions")
    @ApiMessage("Create new question for survey")
    public ResponseEntity<QuestionCreateResponseDTO> createQuestionForSurvey(
            @PathVariable("surveyId") Long surveyId,
            @Valid @RequestBody QuestionCreateRequestDTO request) throws IdInvalidException {

        // Override surveyId từ path parameter nếu chưa có
        if (request.getSurveyId() == null) {
            request.setSurveyId(surveyId);
        }

        // Gọi service method trực tiếp
        QuestionCreateResponseDTO response = questionService.createQuestionWithResponse(surveyId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Lấy danh sách câu hỏi theo survey
     */
    @GetMapping("/questions/survey/{surveyId}")
    @ApiMessage("Get questions by survey")
    public ResponseEntity<List<QuestionResponseDTO>> getQuestionsBySurvey(@PathVariable("surveyId") Long surveyId)
            throws IdInvalidException {
        List<QuestionResponseDTO> questions = questionService.getQuestionsBySurvey(surveyId);
        return ResponseEntity.ok(questions);
    }

    /**
     * Reorder câu hỏi theo danh sách id 1..N
     */
    @PutMapping("/surveys/{surveyId}/questions/reorder")
    @ApiMessage("Reorder questions in survey")
    public ResponseEntity<QuestionReorderResponseDTO> reorderQuestions(
            @PathVariable("surveyId") Long surveyId,
            @Valid @RequestBody QuestionReorderRequestDTO request) throws IdInvalidException {
        questionService.reorderQuestions(surveyId, request.getOrderedQuestionIds());
        return ResponseEntity.ok(new QuestionReorderResponseDTO(surveyId, "Sắp xếp câu hỏi thành công"));
    }

    /**
     * Lấy chi tiết câu hỏi theo id
     */
    @GetMapping("/questions/{id}")
    @ApiMessage("Get question detail")
    public ResponseEntity<QuestionResponseDTO> getQuestionDetail(@PathVariable("id") Long id)
            throws IdInvalidException {
        QuestionResponseDTO questionDTO = questionService.getQuestionById(id);
        return ResponseEntity.ok(questionDTO);
    }

    /**
     * Cập nhật câu hỏi
     */
    @PutMapping("/questions/{id}")
    @ApiMessage("Update question")
    public ResponseEntity<QuestionUpdateResponseDTO> updateQuestion(@PathVariable("id") Long id,
            @Valid @RequestBody QuestionUpdateRequestDTO request) throws IdInvalidException {
        QuestionUpdateResponseDTO response = questionService.updateQuestionWithResponse(id, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Xóa câu hỏi
     */
    @DeleteMapping("/questions/{id}")
    @ApiMessage("Delete question")
    public ResponseEntity<QuestionDeleteResponseDTO> deleteQuestion(@PathVariable("id") Long id)
            throws IdInvalidException {
        questionService.deleteQuestion(id);
        QuestionDeleteResponseDTO response = new QuestionDeleteResponseDTO(id, "Xóa câu hỏi thành công");
        return ResponseEntity.ok(response);
    }

}