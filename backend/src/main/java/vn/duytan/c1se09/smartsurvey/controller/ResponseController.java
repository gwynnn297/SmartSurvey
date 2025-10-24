package vn.duytan.c1se09.smartsurvey.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.duytan.c1se09.smartsurvey.domain.request.response.ResponseSubmitRequestDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.response.ResponseWithAnswersDTO;
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

	@GetMapping("/responses/{surveyId}")
	@ApiMessage("Get responses by survey")
	public ResponseEntity<List<ResponseWithAnswersDTO>> getResponsesBySurvey(@PathVariable("surveyId") Long surveyId)
			throws IdInvalidException {
		return ResponseEntity.ok(responseService.getResponsesBySurvey(surveyId));
	}

	@GetMapping("/responses/{surveyId}/count")
	@ApiMessage("Get response count by survey")
	public ResponseEntity<Map<String, Object>> getResponseCount(@PathVariable("surveyId") Long surveyId)
			throws IdInvalidException {
		long count = responseService.getResponseCountBySurvey(surveyId);
		Map<String, Object> response = new HashMap<>();
		response.put("surveyId", surveyId);
		response.put("totalResponses", count);
		return ResponseEntity.ok(response);
	}

	@GetMapping("/responses/total-count")
	@ApiMessage("Get total response count for all surveys")
	public ResponseEntity<Map<String, Object>> getTotalResponseCount() {
		long totalCount = responseService.getTotalResponseCount();
		Map<String, Object> response = new HashMap<>();
		response.put("totalResponses", totalCount);
		response.put("message", "Tổng số responses của tất cả survey");
		return ResponseEntity.ok(response);
	}

}