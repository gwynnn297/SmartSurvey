package vn.duytan.c1se09.smartsurvey.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.duytan.c1se09.smartsurvey.domain.request.response.ResponseSubmitRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.response.ResponseWithAnswersDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.response.ResponseSummaryDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.response.ResponsePageDTO;
import vn.duytan.c1se09.smartsurvey.domain.request.response.ResponseFilterRequestDTO;
import vn.duytan.c1se09.smartsurvey.service.ResponseService;
import vn.duytan.c1se09.smartsurvey.util.annotation.ApiMessage;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class ResponseController {
	private final ResponseService responseService;

	@PostMapping("/responses")
	@ApiMessage("Submit survey response")
	public ResponseEntity<ResponseWithAnswersDTO> submitResponse(@Valid @RequestBody ResponseSubmitRequestDTO request)
			throws IdInvalidException {
		return ResponseEntity.ok(responseService.submitResponse(request));
	}

	/**
	 * Submit survey response với files (multipart/form-data)
	 */
	@PostMapping("/responses/with-files")
	@ApiMessage("Submit survey response with files")
	public ResponseEntity<ResponseWithAnswersDTO> submitResponseWithFiles(
			@RequestParam("surveyId") Long surveyId,
			@RequestParam("answers") String answersJson,
			@RequestParam Map<String, MultipartFile> files) throws IdInvalidException {
		return ResponseEntity.ok(responseService.submitResponseWithFiles(surveyId, answersJson, files));
	}

	/**
	 * Public submit survey response với files (không cần authentication)
	 */
	@PostMapping("/api/public/responses/with-files")
	@ApiMessage("Public submit survey response with files")
	public ResponseEntity<ResponseWithAnswersDTO> submitPublicResponseWithFiles(
			@RequestParam("surveyId") Long surveyId,
			@RequestParam("answers") String answersJson,
			@RequestParam(value = "durationSeconds", required = false, defaultValue = "0") Integer durationSeconds,
			@RequestParam Map<String, MultipartFile> files) throws IdInvalidException {
		return ResponseEntity.ok(responseService.submitResponseWithFiles(surveyId, answersJson, files));
	}

	/**
	 * Public submit survey response (không có files, không cần authentication)
	 */
	@PostMapping("/api/public/responses")
	@ApiMessage("Public submit survey response")
	public ResponseEntity<ResponseWithAnswersDTO> submitPublicResponse(
			@Valid @RequestBody ResponseSubmitRequestDTO request)
			throws IdInvalidException {
		return ResponseEntity.ok(responseService.submitResponse(request));
	}

	// Responses APIs (standardized URLs)
	/**
	 * List responses with pagination + filtering + search
	 */
	@GetMapping("/api/surveys/{surveyId}/responses")
	@ApiMessage("List responses (paginated)")
	public ResponseEntity<ResponsePageDTO<ResponseSummaryDTO>> listResponses(
			@PathVariable Long surveyId,
			ResponseFilterRequestDTO filter) throws IdInvalidException {
		return ResponseEntity.ok(responseService.listResponses(surveyId, filter));
	}

	/**
	 * Get response detail with all answers
	 */
	@GetMapping("/api/responses/{responseId}")
	@ApiMessage("Get response detail")
	public ResponseEntity<ResponseWithAnswersDTO> getResponseDetail(@PathVariable Long responseId)
			throws IdInvalidException {
		return ResponseEntity.ok(responseService.getResponseDetail(responseId));
	}

	/**
	 * Export CSV/Excel
	 */
	@GetMapping("/api/surveys/{surveyId}/responses/export")
@ApiMessage("Export responses CSV/Excel")
public ResponseEntity<byte[]> exportResponses(
        @PathVariable("surveyId") Long surveyId,
        @RequestParam(name = "format", defaultValue = "csv") String format,
        @RequestParam(name = "includeAnswers", defaultValue = "true") boolean includeAnswers,
        @ModelAttribute ResponseFilterRequestDTO filter
) throws IdInvalidException {
    return responseService.exportResponses(surveyId, filter, format, includeAnswers);
}


	/**
	 * Bulk delete responses
	 */
	@DeleteMapping("/api/surveys/{surveyId}/responses")
	@ApiMessage("Bulk delete responses")
	public ResponseEntity<Map<String, Object>> bulkDelete(
			@PathVariable Long surveyId,
			@RequestBody List<Long> responseIds) throws IdInvalidException {
		int deleted = responseService.bulkDelete(surveyId, responseIds);
		Map<String, Object> resp = new HashMap<>();
		resp.put("deleted", deleted);
		resp.put("requested", responseIds != null ? responseIds.size() : 0);
		return ResponseEntity.ok(resp);
	}

}