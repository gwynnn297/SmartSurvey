package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vn.duytan.c1se09.smartsurvey.domain.*;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyOverviewResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyQuestionCountsDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyTimelineResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyChartsResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyTextAnalysisResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveySentimentResponseDTO;
import vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum;
import vn.duytan.c1se09.smartsurvey.repository.*;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service xử lý thống kê và báo cáo
 */
@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("null")
public class StatisticsService {

    private final SurveyRepository surveyRepository;
    private final ResponseRepository responseRepository;
    private final AnswerRepository answerRepository;
    private final OptionRepository optionRepository;
    private final QuestionRepository questionRepository;
    private final SurveyViewRepository surveyViewRepository;
    private final AuthService authService;
    private final SurveyPermissionService surveyPermissionService;

    // AI service configuration
    private static final String AI_SERVICE_BASE_URL = "http://localhost:8000";
    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Lấy thống kê tổng quan của survey
     */
    public SurveyOverviewResponseDTO getSurveyOverview(Long surveyId) throws IdInvalidException {
        // Kiểm tra survey tồn tại và quyền truy cập
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));

        User currentUser = authService.getCurrentUser();
        if (!surveyPermissionService.canViewResults(survey, currentUser)) {
            throw new IdInvalidException("Bạn không có quyền xem thống kê khảo sát này. Chỉ chủ sở hữu (OWNER) và phân tích viên (ANALYST) mới có quyền xem báo cáo.");
        }

        // Lấy tất cả responses của survey
        List<Response> responses = responseRepository.findBySurvey(survey);

        // Lấy tất cả questions required của survey
        List<Question> requiredQuestions = questionRepository.findBySurveyAndIsRequiredTrue(survey);

        // Tính toán thống kê
        int totalResponses = responses.size();
        int viewership = (int) surveyViewRepository.countBySurvey(survey);
        CompletionTally tally = tallyCompletions(responses, requiredQuestions);
        int completedResponses = tally.completed;
        int partialResponses = tally.partial;

        // Completion rate = (completed / total) * 100
        double completionRate = totalResponses > 0 ? (double) completedResponses / totalResponses * 100 : 0.0;

        // Thời gian trung bình hoàn thành
        String avgCompletionTime = calculateAverageCompletionTime(responses);

        // Demographics: tự nhận diện nếu survey có câu hỏi về tuổi/giới tính
        SurveyOverviewResponseDTO.DemographicsDTO demographics = buildDemographicsIfAvailable(survey, responses);

        // Completion stats
        SurveyOverviewResponseDTO.CompletionStatsDTO completionStats = SurveyOverviewResponseDTO.CompletionStatsDTO
                .builder()
                .completed(completedResponses)
                .partial(partialResponses)
                .dropped(tally.dropped)
                .build();

        return SurveyOverviewResponseDTO.builder()
                .surveyId(survey.getSurveyId())
                .surveyTitle(survey.getTitle())
                .totalResponses(totalResponses)
                .viewership(viewership)
                .completionRate(Math.round(completionRate * 100.0) / 100.0) // Làm tròn 2 chữ số
                .avgCompletionTime(avgCompletionTime)
                .createdAt(survey.getCreatedAt())
                .lastResponseAt(getLastResponseTime(responses))
                .status(survey.getStatus().name().toLowerCase())
                .demographics(demographics)
                .completionStats(completionStats)
                .build();
    }

    /**
     * Đếm nhanh số câu hỏi theo loại để hiển thị ở phần Overview
     */
    public SurveyQuestionCountsDTO getSurveyQuestionCounts(Long surveyId) throws IdInvalidException {
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));

        User currentUser = authService.getCurrentUser();
        if (!surveyPermissionService.canViewResults(survey, currentUser)) {
            throw new IdInvalidException("Bạn không có quyền xem thống kê khảo sát này. Chỉ chủ sở hữu (OWNER) và phân tích viên (ANALYST) mới có quyền xem báo cáo.");
        }

        java.util.List<Question> questions = questionRepository.findBySurvey(survey);
        int total = questions.size();

        java.util.Map<String, Integer> byType = new java.util.LinkedHashMap<>();
        for (QuestionTypeEnum t : QuestionTypeEnum.values()) {
            byType.put(t.name(), 0);
        }

        for (Question q : questions) {
            QuestionTypeEnum t = q.getQuestionType();
            if (t == null)
                continue;
            byType.compute(t.name(), (k, v) -> v == null ? 1 : v + 1);
        }

        return SurveyQuestionCountsDTO.builder()
                .surveyId(surveyId)
                .total(total)
                .byType(byType)
                .build();
    }

    /**
     * Lấy timeline responses của survey
     */
    public SurveyTimelineResponseDTO getSurveyTimeline(Long surveyId) throws IdInvalidException {
        // Kiểm tra survey tồn tại và quyền truy cập
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));

        User currentUser = authService.getCurrentUser();
        if (!surveyPermissionService.canViewResults(survey, currentUser)) {
            throw new IdInvalidException("Bạn không có quyền xem thống kê khảo sát này. Chỉ chủ sở hữu (OWNER) và phân tích viên (ANALYST) mới có quyền xem báo cáo.");
        }

        // Lấy tất cả responses của survey
        List<Response> responses = responseRepository.findBySurvey(survey);

        // Lấy tất cả questions required của survey
        List<Question> requiredQuestions = questionRepository.findBySurveyAndIsRequiredTrue(survey);

        // Tính daily data
        List<SurveyTimelineResponseDTO.DailyDataDTO> dailyData = calculateDailyData(responses, requiredQuestions);

        // Tính hourly data (chỉ lấy 24 giờ gần nhất)
        List<SurveyTimelineResponseDTO.HourlyDataDTO> hourlyData = calculateHourlyData(responses, requiredQuestions);

        return SurveyTimelineResponseDTO.builder()
                .surveyId(survey.getSurveyId())
                .surveyTitle(survey.getTitle())
                .daily(dailyData)
                .hourly(hourlyData)
                .build();
    }

    /**
     * Tính số responses đã hoàn thành đầy đủ
     */
    private int calculateCompletedResponses(List<Response> responses, List<Question> requiredQuestions) {
        int completed = 0;

        for (Response response : responses) {
            // Lấy tất cả answers của response này
            List<Answer> answers = answerRepository.findByResponse(response);

            // Kiểm tra xem có trả lời đủ tất cả required questions không
            boolean isCompleted = true;
            for (Question requiredQuestion : requiredQuestions) {
                boolean hasAnswer = answers.stream()
                        .anyMatch(answer -> answer.getQuestion().getQuestionId()
                                .equals(requiredQuestion.getQuestionId()));
                if (!hasAnswer) {
                    isCompleted = false;
                    break;
                }
            }

            if (isCompleted) {
                completed++;
            }
        }

        return completed;
    }

    /**
     * Đếm completed/partial/dropped theo định nghĩa:
     * - completed: trả đủ mọi câu required
     * - partial: có ít nhất 1 answer nhưng chưa đủ câu required
     * - dropped: không có answer nào
     */
    private CompletionTally tallyCompletions(List<Response> responses, List<Question> requiredQuestions) {
        int completed = 0;
        int partial = 0;
        int dropped = 0;

        for (Response response : responses) {
            List<Answer> answers = answerRepository.findByResponse(response);
            if (answers.isEmpty()) {
                dropped++;
                continue;
            }

            boolean isCompleted = true;
            for (Question requiredQuestion : requiredQuestions) {
                boolean hasAnswer = answers.stream()
                        .anyMatch(answer -> answer.getQuestion().getQuestionId()
                                .equals(requiredQuestion.getQuestionId()));
                if (!hasAnswer) {
                    isCompleted = false;
                    break;
                }
            }

            if (isCompleted) {
                completed++;
            } else {
                partial++;
            }
        }

        return new CompletionTally(completed, partial, dropped);
    }

    private static class CompletionTally {
        final int completed;
        final int partial;
        final int dropped;

        private CompletionTally(int completed, int partial, int dropped) {
            this.completed = completed;
            this.partial = partial;
            this.dropped = dropped;
        }
    }

    /**
     * Tính thời gian trung bình hoàn thành
     */
    private String calculateAverageCompletionTime(List<Response> responses) {
        if (responses.isEmpty()) {
            return "0m 0s";
        }

        long totalSeconds = 0L;
        int counted = 0;

        for (Response r : responses) {
            Integer duration = r.getDurationSeconds();
            if (duration != null && duration > 0) {
                totalSeconds += duration;
                counted++;
            }
        }

        if (counted == 0) {
            return "0m 0s";
        }

        long avg = totalSeconds / counted;
        long minutes = avg / 60;
        long seconds = avg % 60;
        return minutes + "m " + seconds + "s";
    }

    /**
     * Tính demographics
     */
    private SurveyOverviewResponseDTO.DemographicsDTO buildDemographicsIfAvailable(Survey survey,
            List<Response> responses) {
        if (responses.isEmpty())
            return null;

        // 1) Tìm các câu hỏi có thể là tuổi hoặc giới tính theo keyword
        List<Question> questions = questionRepository.findBySurvey(survey);
        Set<Long> ageQuestionIds = new HashSet<>();
        Set<Long> genderQuestionIds = new HashSet<>();

        for (Question q : questions) {
            String text = Optional.ofNullable(q.getQuestionText()).orElse("").toLowerCase();
            if (containsAny(text, List.of("tuổi", "độ tuổi", "age"))) {
                ageQuestionIds.add(q.getQuestionId());
            }
            if (containsAny(text, List.of("giới tính", "gender", "nam", "nữ", "male", "female"))) {
                genderQuestionIds.add(q.getQuestionId());
            }
        }

        final Map<String, Integer> ageBuckets = new LinkedHashMap<>();
        final Map<String, Integer> genderBuckets = new LinkedHashMap<>();

        // preset buckets to keep stable ordering when present
        List<String> ageBucketOrder = List.of("<18", "18-25", "26-35", "36-45", "46-60", ">60");
        ageBucketOrder.forEach(b -> ageBuckets.put(b, 0));

        Map<String, String> genderMap = Map.of(
                "nam", "male",
                "nữ", "female",
                "nu", "female",
                "male", "male",
                "female", "female",
                "khác", "other",
                "other", "other");

        boolean hasAge = false;
        boolean hasGender = false;

        // 2) Duyệt qua các answers của responses để gom demographics
        for (Response r : responses) {
            // gom theo từng question nghi là age/gender
            for (Long qid : ageQuestionIds) {
                List<Answer> answers = answerRepository.findByResponseAndQuestion(r, new Question() {
                    {
                        setQuestionId(qid);
                    }
                });
                for (Answer a : answers) {
                    String candidate = extractAnswerText(a);
                    if (candidate == null || candidate.isBlank())
                        continue;
                    String bucket = bucketAge(candidate);
                    if (bucket != null) {
                        ageBuckets.compute(bucket, (k, v) -> v == null ? 1 : v + 1);
                        hasAge = true;
                    }
                }
            }

            for (Long qid : genderQuestionIds) {
                List<Answer> answers = answerRepository.findByResponseAndQuestion(r, new Question() {
                    {
                        setQuestionId(qid);
                    }
                });
                for (Answer a : answers) {
                    String candidate = Optional.ofNullable(extractAnswerText(a)).orElse("").toLowerCase();
                    if (candidate.isBlank())
                        continue;
                    String normalized = normalizeGender(candidate, genderMap);
                    if (normalized != null) {
                        genderBuckets.compute(normalized, (k, v) -> v == null ? 1 : v + 1);
                        hasGender = true;
                    }
                }
            }
        }

        if (!hasAge && !hasGender)
            return null;

        // Tạo final variables để tránh lỗi lambda
        Map<String, Integer> finalAgeBuckets = null;
        Map<String, Integer> finalGenderBuckets = null;

        if (hasAge) {
            ageBuckets.entrySet().removeIf(e -> e.getValue() == null || e.getValue() == 0);
            finalAgeBuckets = ageBuckets;
        }
        if (hasGender) {
            finalGenderBuckets = genderBuckets;
        }

        return SurveyOverviewResponseDTO.DemographicsDTO.builder()
                .ageGroups(finalAgeBuckets)
                .genderDistribution(finalGenderBuckets)
                .build();
    }

    private boolean containsAny(String text, List<String> needles) {
        for (String n : needles) {
            if (text.contains(n))
                return true;
        }
        return false;
    }

    private String extractAnswerText(Answer a) {
        // Ưu tiên answer_text; nếu null, thử lấy option text
        if (a.getAnswerText() != null && !a.getAnswerText().isBlank())
            return a.getAnswerText();
        if (a.getOption() != null && a.getOption().getOptionText() != null)
            return a.getOption().getOptionText();
        return null;
    }

    private String bucketAge(String raw) {
        String s = raw.trim().toLowerCase();
        // Nếu là khoảng dạng "18-25"
        if (s.matches("\\d+\\s*[-–]\\s*\\d+")) {
            // normalize to standard bucket if matches
            String[] parts = s.split("[-–]");
            try {
                int a = Integer.parseInt(parts[0].trim());
                int b = Integer.parseInt(parts[1].trim());
                return mapAgeToBucket((a + b) / 2);
            } catch (Exception ignored) {
            }
        }
        // Nếu là số đơn lẻ như "18"
        if (s.matches(".*?\\d+.*")) {
            try {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+").matcher(s);
                if (m.find()) {
                    int age = Integer.parseInt(m.group());
                    return mapAgeToBucket(age);
                }
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private String mapAgeToBucket(int age) {
        if (age < 18)
            return "<18";
        if (age <= 25)
            return "18-25";
        if (age <= 35)
            return "26-35";
        if (age <= 45)
            return "36-45";
        if (age <= 60)
            return "46-60";
        return ">60";
    }

    private String normalizeGender(String candidate, Map<String, String> genderMap) {
        String c = candidate.toLowerCase();
        for (Map.Entry<String, String> e : genderMap.entrySet()) {
            if (c.contains(e.getKey()))
                return e.getValue();
        }
        return null;
    }

    /**
     * Lấy thời gian response cuối cùng
     */
    private LocalDateTime getLastResponseTime(List<Response> responses) {
        return responses.stream()
                .map(Response::getSubmittedAt)
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElse(null);
    }

    /**
     * Tính dữ liệu theo ngày
     */
    private List<SurveyTimelineResponseDTO.DailyDataDTO> calculateDailyData(List<Response> responses,
            List<Question> requiredQuestions) {
        Map<String, List<Response>> responsesByDate = responses.stream()
                .collect(Collectors.groupingBy(
                        response -> response.getSubmittedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))));

        List<SurveyTimelineResponseDTO.DailyDataDTO> dailyData = new ArrayList<>();

        for (Map.Entry<String, List<Response>> entry : responsesByDate.entrySet()) {
            String date = entry.getKey();
            List<Response> dayResponses = entry.getValue();

            int completed = calculateCompletedResponses(dayResponses, requiredQuestions);
            int total = dayResponses.size();
            int partial = total - completed;

            dailyData.add(SurveyTimelineResponseDTO.DailyDataDTO.builder()
                    .date(date)
                    .count(total)
                    .completed(completed)
                    .partial(partial)
                    .build());
        }

        // Sắp xếp theo ngày
        dailyData.sort(Comparator.comparing(SurveyTimelineResponseDTO.DailyDataDTO::getDate));

        return dailyData;
    }

    /**
     * Tính dữ liệu theo giờ (24 giờ gần nhất)
     */
    private List<SurveyTimelineResponseDTO.HourlyDataDTO> calculateHourlyData(List<Response> responses,
            List<Question> requiredQuestions) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfDay = now.minusDays(1);

        // Lọc responses trong 24 giờ gần nhất
        List<Response> recentResponses = responses.stream()
                .filter(response -> response.getSubmittedAt().isAfter(startOfDay))
                .collect(Collectors.toList());

        Map<String, List<Response>> responsesByHour = recentResponses.stream()
                .collect(Collectors.groupingBy(
                        response -> response.getSubmittedAt().format(DateTimeFormatter.ofPattern("HH:mm"))));

        List<SurveyTimelineResponseDTO.HourlyDataDTO> hourlyData = new ArrayList<>();

        for (Map.Entry<String, List<Response>> entry : responsesByHour.entrySet()) {
            String hour = entry.getKey();
            List<Response> hourResponses = entry.getValue();

            int completed = calculateCompletedResponses(hourResponses, requiredQuestions);
            int total = hourResponses.size();

            hourlyData.add(SurveyTimelineResponseDTO.HourlyDataDTO.builder()
                    .hour(hour)
                    .count(total)
                    .completed(completed)
                    .build());
        }

        // Sắp xếp theo giờ
        hourlyData.sort(Comparator.comparing(SurveyTimelineResponseDTO.HourlyDataDTO::getHour));

        return hourlyData;
    }

    /**
     * Lấy dữ liệu biểu đồ cho survey
     */
    public SurveyChartsResponseDTO getSurveyCharts(Long surveyId) throws IdInvalidException {
        // Kiểm tra survey tồn tại và quyền truy cập
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));

        User currentUser = authService.getCurrentUser();
        if (!surveyPermissionService.canViewResults(survey, currentUser)) {
            throw new IdInvalidException("Bạn không có quyền xem thống kê khảo sát này. Chỉ chủ sở hữu (OWNER) và phân tích viên (ANALYST) mới có quyền xem báo cáo.");
        }

        // Lấy tất cả questions của survey
        List<Question> questions = questionRepository.findBySurveyOrderByDisplayOrderAsc(survey);

        // Phân loại và xử lý từng loại câu hỏi
        List<SurveyChartsResponseDTO.MultipleChoiceDataDTO> multipleChoiceData = new ArrayList<>();
        List<SurveyChartsResponseDTO.RatingDataDTO> ratingData = new ArrayList<>();
        List<SurveyChartsResponseDTO.BooleanDataDTO> booleanData = new ArrayList<>();

        for (Question question : questions) {
            QuestionTypeEnum questionType = question.getQuestionType();

            switch (questionType) {
                case multiple_choice:
                case single_choice:
                    multipleChoiceData.add(buildMultipleChoiceData(question));
                    break;
                case rating:
                    ratingData.add(buildRatingData(question));
                    break;
                case boolean_:
                    booleanData.add(buildBooleanData(question));
                    break;
                case ranking:
                    // Ranking được xử lý như multiple choice với weighted scoring
                    multipleChoiceData.add(buildMultipleChoiceData(question));
                    break;
                case date_time:
                    // Date/time questions - hiển thị thống kê responses theo thời gian
                    // TODO: Implement specific date/time statistics in future
                    // For now, skip these questions in charts
                    break;
                case file_upload:
                    // File upload questions - hiển thị thống kê file uploads
                    // TODO: Implement specific file upload statistics in future
                    // For now, skip these questions in charts
                    break;
                default:
                    // Bỏ qua các loại câu hỏi khác (open_ended)
                    break;
            }
        }

        return SurveyChartsResponseDTO.builder()
                .multipleChoiceData(multipleChoiceData)
                .ratingData(ratingData)
                .booleanData(booleanData)
                .build();
    }

    /**
     * Xây dựng dữ liệu biểu đồ cho câu hỏi multiple choice/single choice/ranking
     */
    private SurveyChartsResponseDTO.MultipleChoiceDataDTO buildMultipleChoiceData(Question question) {
        // Lấy tất cả options của question
        List<Option> options = optionRepository.findByQuestionOrderByCreatedAt(question);

        // Lấy tất cả answers cho question này
        List<Answer> answers = answerRepository.findByQuestion(question);

        QuestionTypeEnum questionType = question.getQuestionType();

        if (questionType == QuestionTypeEnum.ranking) {
            return buildRankingData(question, options, answers);
        } else {
            // Logic cũ cho multiple choice và single choice
            Map<Long, Integer> optionCounts = new HashMap<>();

            for (Answer answer : answers) {
                if (answer.getOption() != null) {
                    Long optionId = answer.getOption().getOptionId();
                    optionCounts.put(optionId, optionCounts.getOrDefault(optionId, 0) + 1);
                }
            }

            // Tính tổng số responses (unique responses)
            int totalResponses = (int) answers.stream()
                    .map(answer -> answer.getResponse().getResponseId())
                    .distinct()
                    .count();

            // Xây dựng chart data
            List<SurveyChartsResponseDTO.MultipleChoiceDataDTO.ChartDataDTO> chartData = new ArrayList<>();

            for (Option option : options) {
                int count = optionCounts.getOrDefault(option.getOptionId(), 0);
                double percentage = totalResponses > 0 ? (double) count / totalResponses * 100 : 0.0;

                chartData.add(SurveyChartsResponseDTO.MultipleChoiceDataDTO.ChartDataDTO.builder()
                        .option(option.getOptionText())
                        .count(count)
                        .percentage(Math.round(percentage * 100.0) / 100.0) // Làm tròn 2 chữ số
                        .build());
            }

            return SurveyChartsResponseDTO.MultipleChoiceDataDTO.builder()
                    .questionId(question.getQuestionId())
                    .questionText(question.getQuestionText())
                    .chartData(chartData)
                    .chartType("pie")
                    .build();
        }
    }

    /**
     * Xây dựng dữ liệu biểu đồ cho câu hỏi ranking với weighted scoring
     */
    private SurveyChartsResponseDTO.MultipleChoiceDataDTO buildRankingData(Question question, List<Option> options,
            List<Answer> answers) {
        // Group answers by response để validate ranking
        Map<Long, List<Answer>> answersByResponse = answers.stream()
                .collect(Collectors.groupingBy(answer -> answer.getResponse().getResponseId()));

        Map<Long, Double> optionWeightedScores = new HashMap<>();
        Map<Long, Integer> optionRankCounts = new HashMap<>();
        int validResponses = 0;

        for (Map.Entry<Long, List<Answer>> entry : answersByResponse.entrySet()) {
            List<Answer> responseAnswers = entry.getValue();

            // Validate ranking: phải xếp hạng đủ tất cả options
            if (responseAnswers.size() != options.size()) {
                log.warn("Response {} has incomplete ranking: {} answers for {} options",
                        entry.getKey(), responseAnswers.size(), options.size());
                continue; // Bỏ qua response không hợp lệ
            }

            // Validate ranking positions (1 to n)
            Set<Integer> usedRanks = new HashSet<>();
            boolean validRanking = true;

            for (Answer answer : responseAnswers) {
                try {
                    if (answer.getAnswerText() == null || answer.getAnswerText().trim().isEmpty()) {
                        validRanking = false;
                        break;
                    }
                    int rank = Integer.parseInt(answer.getAnswerText().trim());
                    if (rank < 1 || rank > options.size() || usedRanks.contains(rank)) {
                        validRanking = false;
                        break;
                    }
                    usedRanks.add(rank);
                } catch (NumberFormatException e) {
                    validRanking = false;
                    break;
                }
            }

            if (!validRanking) {
                log.warn("Response {} has invalid ranking positions", entry.getKey());
                continue; // Bỏ qua response không hợp lệ
            }

            // Tính weighted score cho response hợp lệ
            validResponses++;
            for (Answer answer : responseAnswers) {
                Long optionId;

                // Handle cả trường hợp có option_id và không có option_id
                if (answer.getOption() != null) {
                    // Old format: có option_id
                    optionId = answer.getOption().getOptionId();
                } else {
                    // New format: option_id = NULL, map theo thứ tự trong responseAnswers
                    // Sắp xếp answers theo created_at để đảm bảo thứ tự
                    List<Answer> sortedAnswers = responseAnswers.stream()
                            .sorted((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()))
                            .collect(Collectors.toList());

                    int answerIndex = sortedAnswers.indexOf(answer);
                    if (answerIndex >= 0 && answerIndex < options.size()) {
                        optionId = options.get(answerIndex).getOptionId();
                    } else {
                        log.warn("Cannot map answer to option for response {}", entry.getKey());
                        continue;
                    }
                }

                int rank = Integer.parseInt(answer.getAnswerText().trim());
                // Score = (n - rank + 1) where n = total options
                // Rank 1 = highest score, Rank n = lowest score
                double score = options.size() - rank + 1;

                optionWeightedScores.put(optionId,
                        optionWeightedScores.getOrDefault(optionId, 0.0) + score);
                optionRankCounts.put(optionId,
                        optionRankCounts.getOrDefault(optionId, 0) + 1);
            }
        }

        // Xây dựng chart data với weighted scores
        List<SurveyChartsResponseDTO.MultipleChoiceDataDTO.ChartDataDTO> chartData = new ArrayList<>();
        double maxScore = validResponses > 0 ? (double) options.size() * validResponses : 1.0;

        for (Option option : options) {
            double weightedScore = optionWeightedScores.getOrDefault(option.getOptionId(), 0.0);
            int count = optionRankCounts.getOrDefault(option.getOptionId(), 0);
            double percentage = maxScore > 0 ? (weightedScore / maxScore) * 100.0 : 0.0;

            chartData.add(SurveyChartsResponseDTO.MultipleChoiceDataDTO.ChartDataDTO.builder()
                    .option(option.getOptionText())
                    .count(count) // Số lần được xếp hạng
                    .percentage(Math.round(percentage * 100.0) / 100.0) // Weighted score percentage
                    .build());
        }

        // Sắp xếp theo weighted score giảm dần
        chartData.sort((a, b) -> Double.compare(b.getPercentage(), a.getPercentage()));

        return SurveyChartsResponseDTO.MultipleChoiceDataDTO.builder()
                .questionId(question.getQuestionId())
                .questionText(question.getQuestionText())
                .chartData(chartData)
                .chartType("bar")
                .build();
    }

    /**
     * Xây dựng dữ liệu biểu đồ cho câu hỏi rating
     */
    private SurveyChartsResponseDTO.RatingDataDTO buildRatingData(Question question) {
        // Lấy tất cả answers cho question này
        List<Answer> answers = answerRepository.findByQuestion(question);

        // Đếm distribution và tính average
        Map<String, Integer> distribution = new HashMap<>();
        List<Integer> ratings = new ArrayList<>();

        for (Answer answer : answers) {
            try {
                // Giả sử rating được lưu trong answerText dưới dạng số
                if (answer.getAnswerText() != null && !answer.getAnswerText().trim().isEmpty()) {
                    int rating = Integer.parseInt(answer.getAnswerText().trim());
                    if (rating >= 1 && rating <= 5) { // Giả sử scale 1-5
                        String ratingStr = String.valueOf(rating);
                        distribution.put(ratingStr, distribution.getOrDefault(ratingStr, 0) + 1);
                        ratings.add(rating);
                    }
                }
            } catch (NumberFormatException e) {
                // Bỏ qua answers không phải số
                log.warn("Invalid rating value for question {}: {}", question.getQuestionId(), answer.getAnswerText());
            }
        }

        // Tính average rating
        double averageRating = ratings.isEmpty() ? 0.0
                : ratings.stream().mapToInt(Integer::intValue).average().orElse(0.0);

        return SurveyChartsResponseDTO.RatingDataDTO.builder()
                .questionId(question.getQuestionId())
                .questionText(question.getQuestionText())
                .averageRating(Math.round(averageRating * 100.0) / 100.0) // Làm tròn 2 chữ số
                .distribution(distribution)
                .build();
    }

    /**
     * Xây dựng dữ liệu biểu đồ cho câu hỏi boolean
     */
    private SurveyChartsResponseDTO.BooleanDataDTO buildBooleanData(Question question) {
        // Lấy tất cả answers cho question này
        List<Answer> answers = answerRepository.findByQuestion(question);

        int trueCount = 0;
        int falseCount = 0;

        for (Answer answer : answers) {
            // Kiểm tra option text thay vì answer text cho boolean questions
            if (answer.getOption() != null && answer.getOption().getOptionText() != null) {
                String optionText = answer.getOption().getOptionText().trim().toLowerCase();
                if ("true".equals(optionText) || "đúng".equals(optionText) || "có".equals(optionText)
                        || "yes".equals(optionText)) {
                    trueCount++;
                } else if ("false".equals(optionText) || "sai".equals(optionText) || "không".equals(optionText)
                        || "no".equals(optionText)) {
                    falseCount++;
                }
            }
            // Fallback: nếu không có option, kiểm tra answer text
            else if (answer.getAnswerText() != null) {
                String answerText = answer.getAnswerText().trim().toLowerCase();
                if ("true".equals(answerText) || "đúng".equals(answerText) || "có".equals(answerText)
                        || "yes".equals(answerText)) {
                    trueCount++;
                } else if ("false".equals(answerText) || "sai".equals(answerText) || "không".equals(answerText)
                        || "no".equals(answerText)) {
                    falseCount++;
                }
            }
        }

        int totalResponses = trueCount + falseCount;
        double truePercentage = totalResponses > 0 ? (double) trueCount / totalResponses * 100 : 0.0;

        return SurveyChartsResponseDTO.BooleanDataDTO.builder()
                .questionId(question.getQuestionId())
                .questionText(question.getQuestionText())
                .trueCount(trueCount)
                .falseCount(falseCount)
                .truePercentage(Math.round(truePercentage * 100.0) / 100.0) // Làm tròn 2 chữ số
                .build();
    }

    /**
     * Lấy text analysis dữ liệu cho survey từ AI service
     */
    public SurveyTextAnalysisResponseDTO getSurveyTextAnalysis(Long surveyId) throws IdInvalidException {
        // Kiểm tra survey tồn tại và quyền truy cập
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));

        User currentUser = authService.getCurrentUser();
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền xem phân tích khảo sát này");
        }

        // Lấy tất cả open-ended questions của survey
        List<Question> openEndedQuestions = questionRepository.findBySurveyOrderByDisplayOrderAsc(survey)
                .stream()
                .filter(q -> q.getQuestionType() == QuestionTypeEnum.open_ended)
                .collect(Collectors.toList());

        if (openEndedQuestions.isEmpty()) {
            // Trả về dữ liệu trống nếu không có câu hỏi open-ended
            return SurveyTextAnalysisResponseDTO.builder()
                    .openEndedSummary(SurveyTextAnalysisResponseDTO.OpenEndedSummaryDTO.builder()
                            .totalAnswers(0)
                            .avgLength(0)
                            .keyInsights("Không có câu hỏi mở để phân tích")
                            .commonKeywords(new ArrayList<>())
                            .themes(new ArrayList<>())
                            .build())
                    .build();
        }

        // Lấy tất cả answers cho open-ended questions
        List<Answer> openEndedAnswers = new ArrayList<>();
        for (Question question : openEndedQuestions) {
            openEndedAnswers.addAll(answerRepository.findByQuestion(question));
        }

        // Lọc những answers có text
        List<Answer> validAnswers = openEndedAnswers.stream()
                .filter(answer -> answer.getAnswerText() != null && !answer.getAnswerText().trim().isEmpty())
                .collect(Collectors.toList());

        int totalAnswers = validAnswers.size();

        // Tính average length
        int avgLength = totalAnswers > 0 ? (int) Math.round(validAnswers.stream()
                .mapToInt(answer -> answer.getAnswerText().length())
                .average()
                .orElse(0.0)) : 0;

        // Gọi AI service để lấy keywords và themes
        List<SurveyTextAnalysisResponseDTO.OpenEndedSummaryDTO.CommonKeywordDTO> commonKeywords = new ArrayList<>();
        List<SurveyTextAnalysisResponseDTO.OpenEndedSummaryDTO.ThemeDTO> themes = new ArrayList<>();
        List<String> keyInsights = new ArrayList<>();

        try {
            // Gọi AI service trực tiếp để lấy keywords
            String keywordsUrl = AI_SERVICE_BASE_URL + "/ai/keywords/" + surveyId;

            ResponseEntity<Map<String, Object>> keywordsResponse = restTemplate.exchange(
                    keywordsUrl,
                    HttpMethod.POST,
                    null,
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {
                    });

            if (keywordsResponse.getStatusCode() == HttpStatus.OK && keywordsResponse.getBody() != null) {
                Map<String, Object> keywordsData = keywordsResponse.getBody();

                if (keywordsData != null && keywordsData.get("ok").equals(true)
                        && keywordsData.containsKey("keywords")) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> keywordsList = (List<Map<String, Object>>) keywordsData.get("keywords");

                    for (Map<String, Object> kw : keywordsList) {
                        // Convert decimal score (0.0-1.0) to meaningful frequency (multiply by 100 and
                        // round)
                        double score = ((Number) kw.get("score")).doubleValue();
                        int frequency = (int) Math.round(score * 100);

                        commonKeywords.add(SurveyTextAnalysisResponseDTO.OpenEndedSummaryDTO.CommonKeywordDTO.builder()
                                .word((String) kw.get("keyword")) // AI service trả về "keyword", không phải "word"
                                .frequency(frequency) // Convert score to frequency percentage
                                .build());
                    }
                }
            }

            // Gọi AI service trực tiếp để lấy themes
            String themesUrl = AI_SERVICE_BASE_URL + "/ai/themes/" + surveyId;

            ResponseEntity<Map<String, Object>> themesResponse = restTemplate.exchange(
                    themesUrl,
                    HttpMethod.POST,
                    null,
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {
                    });

            if (themesResponse.getStatusCode() == HttpStatus.OK && themesResponse.getBody() != null) {
                Map<String, Object> themesData = themesResponse.getBody();

                if (themesData != null && themesData.get("ok").equals(true) && themesData.containsKey("themes")) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> themesList = (List<Map<String, Object>>) themesData.get("themes");

                    for (Map<String, Object> theme : themesList) {
                        // AI service trả về format: {"cluster": 0, "size": 11, "examples": [...]}
                        int clusterNum = ((Number) theme.get("cluster")).intValue();
                        int size = ((Number) theme.get("size")).intValue();

                        // Analyze sentiment based on cluster size and content
                        String sentiment = "neutral"; // default
                        if (size >= 3) {
                            sentiment = "positive"; // Larger clusters tend to be more significant/positive
                        } else if (size == 1) {
                            sentiment = "neutral"; // Single items are usually neutral
                        }

                        themes.add(SurveyTextAnalysisResponseDTO.OpenEndedSummaryDTO.ThemeDTO.builder()
                                .theme("Theme " + (clusterNum + 1)) // More user-friendly naming (Theme 1, Theme 2)
                                .mentions(size) // AI service trả về "size"
                                .sentiment(sentiment) // Improved sentiment logic
                                .build());
                    }
                }
            }

            // Gọi AI service để lấy summary thông minh
            String summaryUrl = AI_SERVICE_BASE_URL + "/ai/summary/" + surveyId;

            ResponseEntity<Map<String, Object>> summaryResponse = restTemplate.exchange(
                    summaryUrl,
                    HttpMethod.POST,
                    null,
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {
                    });

            if (summaryResponse.getStatusCode() == HttpStatus.OK && summaryResponse.getBody() != null) {
                Map<String, Object> summaryData = summaryResponse.getBody();

                if (summaryData != null && summaryData.get("ok").equals(true) && summaryData.containsKey("summary")) {
                    // Sử dụng AI summary làm key insights chính
                    String aiSummary = (String) summaryData.get("summary");
                    keyInsights.add(aiSummary);
                } else {
                    // Fallback về insights cơ bản nếu AI không có summary
                    keyInsights.add("Tổng cộng " + totalAnswers + " câu trả lời văn bản");
                    keyInsights.add("Độ dài trung bình: " + avgLength + " ký tự");

                    if (!commonKeywords.isEmpty()) {
                        SurveyTextAnalysisResponseDTO.OpenEndedSummaryDTO.CommonKeywordDTO topKeyword = commonKeywords
                                .get(0);
                        keyInsights.add("Từ khóa phổ biến nhất: \"" + topKeyword.getWord() + "\" ("
                                + topKeyword.getFrequency() + " lần)");
                    }

                    if (!themes.isEmpty()) {
                        keyInsights.add("Đã xác định được " + themes.size() + " chủ đề chính");
                    }
                }
            } else {
                // Fallback về insights cơ bản nếu không gọi được AI service
                keyInsights.add("Tổng cộng " + totalAnswers + " câu trả lời văn bản");
                keyInsights.add("Độ dài trung bình: " + avgLength + " ký tự");

                if (!commonKeywords.isEmpty()) {
                    SurveyTextAnalysisResponseDTO.OpenEndedSummaryDTO.CommonKeywordDTO topKeyword = commonKeywords
                            .get(0);
                    keyInsights.add("Từ khóa phổ biến nhất: \"" + topKeyword.getWord() + "\" ("
                            + topKeyword.getFrequency() + " lần)");
                }

                if (!themes.isEmpty()) {
                    keyInsights.add("Đã xác định được " + themes.size() + " chủ đề chính");
                }
            }

        } catch (Exception e) {
            log.error("Lỗi khi gọi AI service cho text analysis của survey {}: {}", surveyId, e.getMessage());
            keyInsights.add("Không thể phân tích AI: " + e.getMessage());
        }

        return SurveyTextAnalysisResponseDTO.builder()
                .openEndedSummary(SurveyTextAnalysisResponseDTO.OpenEndedSummaryDTO.builder()
                        .totalAnswers(totalAnswers)
                        .avgLength(avgLength)
                        .keyInsights(String.join("; ", keyInsights)) // Nối các insights thành string
                        .commonKeywords(commonKeywords)
                        .themes(themes)
                        .build())
                .build();
    }

    /**
     * Lấy sentiment analysis dữ liệu cho survey
     */
    public SurveySentimentResponseDTO getSurveySentimentAnalysis(Long surveyId) throws IdInvalidException {
        // Kiểm tra survey tồn tại và quyền truy cập
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));

        User currentUser = authService.getCurrentUser();
        if (!surveyPermissionService.canViewResults(survey, currentUser)) {
            throw new IdInvalidException("Bạn không có quyền xem phân tích cảm xúc khảo sát này. Chỉ chủ sở hữu (OWNER) và phân tích viên (ANALYST) mới có quyền xem báo cáo.");
        }

        // Lấy tất cả open-ended questions của survey
        List<Question> openEndedQuestions = questionRepository.findBySurveyOrderByDisplayOrderAsc(survey)
                .stream()
                .filter(q -> q.getQuestionType() == QuestionTypeEnum.open_ended)
                .collect(Collectors.toList());

        if (openEndedQuestions.isEmpty()) {
            // Trả về dữ liệu trống nếu không có câu hỏi open-ended
            return createEmptySentimentResponse();
        }

        try {
            // Gọi AI service để lấy sentiment data thông qua REST call
            String aiServiceUrl = AI_SERVICE_BASE_URL + "/ai/basic-sentiment/" + surveyId;

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    aiServiceUrl,
                    HttpMethod.POST,
                    null,
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {
                    });

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> sentimentResponse = response.getBody();

                if (sentimentResponse == null || sentimentResponse.get("ok") == null
                        || !sentimentResponse.get("ok").equals(true)) {
                    log.warn("AI service trả về lỗi cho sentiment analysis: {}",
                            sentimentResponse != null ? sentimentResponse.get("error") : "null response");
                    return createEmptySentimentResponse();
                }

                // Parse sentiment data từ AI response
                return parseSentimentFromAiResponse(surveyId, sentimentResponse, openEndedQuestions);
            } else {
                log.warn("AI service trả về status code: {}", response.getStatusCode());
                return createEmptySentimentResponse();
            }

        } catch (Exception e) {
            log.error("Lỗi khi gọi AI service cho sentiment analysis của survey {}: {}", surveyId, e.getMessage());
            return createEmptySentimentResponse();
        }
    }

    /**
     * Tạo response trống cho sentiment analysis
     */
    private SurveySentimentResponseDTO createEmptySentimentResponse() {
        return SurveySentimentResponseDTO.builder()
                .overall(SurveySentimentResponseDTO.SentimentOverallDTO.builder()
                        .positive(0.0)
                        .neutral(0.0)
                        .negative(0.0)
                        .build())
                .byQuestion(new ArrayList<>())
                .trends(new ArrayList<>())
                .build();
    }

    /**
     * Parse sentiment data từ AI response
     * AI response format: {"ok": true, "total": 15, "counts": {"POS": 4, "NEU": 10,
     * "NEG": 1}}
     */
    private SurveySentimentResponseDTO parseSentimentFromAiResponse(Long surveyId,
            Map<String, Object> aiResponse,
            List<Question> openEndedQuestions) {

        // Parse counts từ AI response
        @SuppressWarnings("unchecked")
        Map<String, Object> counts = (Map<String, Object>) aiResponse.getOrDefault("counts", new HashMap<>());

        int positiveCount = ((Number) counts.getOrDefault("POS", 0)).intValue();
        int neutralCount = ((Number) counts.getOrDefault("NEU", 0)).intValue();
        int negativeCount = ((Number) counts.getOrDefault("NEG", 0)).intValue();
        int total = ((Number) aiResponse.getOrDefault("total", 1)).intValue();

        // Tính phần trăm
        double positivePercent = total > 0 ? (double) positiveCount / total * 100 : 0.0;
        double neutralPercent = total > 0 ? (double) neutralCount / total * 100 : 0.0;
        double negativePercent = total > 0 ? (double) negativeCount / total * 100 : 0.0;

        SurveySentimentResponseDTO.SentimentOverallDTO overall = SurveySentimentResponseDTO.SentimentOverallDTO
                .builder()
                .positive(positivePercent)
                .neutral(neutralPercent)
                .negative(negativePercent)
                .build();

        // Parse by question sentiment - tạo cho từng open-ended question
        List<SurveySentimentResponseDTO.SentimentByQuestionDTO> byQuestion = new ArrayList<>();

        for (Question question : openEndedQuestions) {
            // Tính sentiment cho từng question (sử dụng tỉ lệ chung vì AI service chưa trả
            // về by question)
            byQuestion.add(SurveySentimentResponseDTO.SentimentByQuestionDTO.builder()
                    .questionId(question.getQuestionId())
                    .questionText(question.getQuestionText())
                    .positive(positivePercent)
                    .neutral(neutralPercent)
                    .negative(negativePercent)
                    .totalResponses(total)
                    .build());
        }

        // Không cần trends phức tạp, chỉ trả về empty list
        List<SurveySentimentResponseDTO.SentimentTrendDTO> trends = new ArrayList<>();

        return SurveySentimentResponseDTO.builder()
                .overall(overall)
                .byQuestion(byQuestion)
                .trends(trends)
                .build();
    }

    /**
     * Xuất báo cáo PDF với biểu đồ cho survey
     */
    public byte[] exportSurveyReportPDF(Long surveyId) throws IdInvalidException {
        // Kiểm tra survey tồn tại và quyền truy cập
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));

        User currentUser = authService.getCurrentUser();
        if (!surveyPermissionService.canViewResults(survey, currentUser)) {
            throw new IdInvalidException("Bạn không có quyền xem thống kê khảo sát này. Chỉ chủ sở hữu (OWNER) và phân tích viên (ANALYST) mới có quyền xem báo cáo.");
        }

        // Lấy dữ liệu thống kê
        SurveyOverviewResponseDTO overview = getSurveyOverview(surveyId);
        SurveyChartsResponseDTO charts = getSurveyCharts(surveyId);
        SurveyTimelineResponseDTO timeline = getSurveyTimeline(surveyId);
        SurveySentimentResponseDTO sentiment = getSurveySentimentAnalysis(surveyId);

        // Set headless mode cho AWT (cần thiết khi chạy trên server không có display)
        System.setProperty("java.awt.headless", "true");

        try {
            // Tạo PDF document
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            com.itextpdf.kernel.pdf.PdfDocument pdfDoc = new com.itextpdf.kernel.pdf.PdfDocument(
                    new com.itextpdf.kernel.pdf.PdfWriter(baos));
            com.itextpdf.layout.Document document = new com.itextpdf.layout.Document(pdfDoc);
            document.setMargins(50, 50, 50, 50);

            // Fonts - Sử dụng font hỗ trợ tiếng Việt (Arial trên Windows)
            com.itextpdf.kernel.font.PdfFont font;
            com.itextpdf.kernel.font.PdfFont fontBold;
            
            try {
                // Ưu tiên sử dụng Arial (hỗ trợ tiếng Việt tốt)
                String osName = System.getProperty("os.name", "").toLowerCase();
                String arialPath = null;
                String arialBoldPath = null;
                
                if (osName.contains("win")) {
                    // Windows
                    arialPath = "C:/Windows/Fonts/arial.ttf";
                    arialBoldPath = "C:/Windows/Fonts/arialbd.ttf";
                } else if (osName.contains("mac")) {
                    // macOS
                    arialPath = "/System/Library/Fonts/Supplemental/Arial.ttf";
                    arialBoldPath = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";
                } else {
                    // Linux - thử DejaVu Sans
                    arialPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
                    arialBoldPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
                }
                
                font = null;
                fontBold = null;
                
                // Thử load Arial
                if (arialPath != null) {
                    try {
                        java.io.File fontFile = new java.io.File(arialPath);
                        if (fontFile.exists()) {
                            byte[] fontBytes = java.nio.file.Files.readAllBytes(fontFile.toPath());
                            font = com.itextpdf.kernel.font.PdfFontFactory.createFont(fontBytes, 
                                    com.itextpdf.io.font.PdfEncodings.IDENTITY_H);
                            log.info("Loaded Arial font from: {}", arialPath);
                            
                            // Thử load Arial Bold
                            if (arialBoldPath != null) {
                                java.io.File boldFile = new java.io.File(arialBoldPath);
                                if (boldFile.exists()) {
                                    byte[] boldBytes = java.nio.file.Files.readAllBytes(boldFile.toPath());
                                    fontBold = com.itextpdf.kernel.font.PdfFontFactory.createFont(boldBytes, 
                                            com.itextpdf.io.font.PdfEncodings.IDENTITY_H);
                                    log.info("Loaded Arial Bold font from: {}", arialBoldPath);
                                } else {
                                    fontBold = font; // Dùng font thường nếu không có bold
                                }
                            }
                        }
                    } catch (Exception e) {
                        log.warn("Could not load Arial font: {}", e.getMessage());
                    }
                }
                
                // Fallback về StandardFonts nếu không tìm thấy font Unicode
                if (font == null) {
                    log.warn("No Unicode font found, using StandardFonts (may lose Vietnamese characters)");
                    font = com.itextpdf.kernel.font.PdfFontFactory.createFont(
                            com.itextpdf.io.font.constants.StandardFonts.HELVETICA);
                    fontBold = com.itextpdf.kernel.font.PdfFontFactory.createFont(
                            com.itextpdf.io.font.constants.StandardFonts.HELVETICA_BOLD);
                }
            } catch (Exception e) {
                log.error("Error loading fonts, using StandardFonts: {}", e.getMessage());
                font = com.itextpdf.kernel.font.PdfFontFactory.createFont(
                        com.itextpdf.io.font.constants.StandardFonts.HELVETICA);
                fontBold = com.itextpdf.kernel.font.PdfFontFactory.createFont(
                        com.itextpdf.io.font.constants.StandardFonts.HELVETICA_BOLD);
            }

            // Tiêu đề
            com.itextpdf.layout.element.Paragraph title = new com.itextpdf.layout.element.Paragraph(
                    overview.getSurveyTitle() != null ? overview.getSurveyTitle() : "Báo cáo khảo sát")
                    .setFont(fontBold)
                    .setFontSize(20)
                    .setMarginBottom(10);
            document.add(title);

            // Thông tin survey
            com.itextpdf.layout.element.Paragraph surveyInfo = new com.itextpdf.layout.element.Paragraph(
                    String.format("ID: %d | Ngày tạo: %s | Trạng thái: %s",
                            overview.getSurveyId(),
                            overview.getCreatedAt() != null
                                    ? overview.getCreatedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                                    : "N/A",
                            overview.getStatus()))
                    .setFont(font)
                    .setFontSize(10)
                    .setMarginBottom(20);
            document.add(surveyInfo);

            // Thống kê tổng quan
            com.itextpdf.layout.element.Paragraph overviewTitle = new com.itextpdf.layout.element.Paragraph(
                    "Thống kê tổng quan")
                    .setFont(fontBold)
                    .setFontSize(16)
                    .setMarginTop(20)
                    .setMarginBottom(10);
            document.add(overviewTitle);

            // Bảng thống kê
            float[] columnWidths = {1, 1};
            com.itextpdf.layout.element.Table statsTable = new com.itextpdf.layout.element.Table(columnWidths);
            statsTable.setWidth(480);

            addTableRow(statsTable, "Tổng số phản hồi", String.valueOf(overview.getTotalResponses()), font, fontBold);
            addTableRow(statsTable, "Số lượt xem", String.valueOf(overview.getViewership()), font, fontBold);
            addTableRow(statsTable, "Tỷ lệ hoàn thành", String.format("%.2f%%", overview.getCompletionRate()), font,
                    fontBold);
            addTableRow(statsTable, "Thời gian trung bình", overview.getAvgCompletionTime() != null
                    ? overview.getAvgCompletionTime()
                    : "N/A", font, fontBold);

            if (overview.getCompletionStats() != null) {
                addTableRow(statsTable, "Hoàn thành đầy đủ",
                        String.valueOf(overview.getCompletionStats().getCompleted()), font, fontBold);
                addTableRow(statsTable, "Hoàn thành một phần",
                        String.valueOf(overview.getCompletionStats().getPartial()), font, fontBold);
                addTableRow(statsTable, "Đã bỏ dở",
                        String.valueOf(overview.getCompletionStats().getDropped()), font, fontBold);
            }

            document.add(statsTable);

            // Biểu đồ
            if (charts != null) {
                // Phân loại Multiple Choice Charts theo loại câu hỏi
                if (charts.getMultipleChoiceData() != null && !charts.getMultipleChoiceData().isEmpty()) {
                    // Phân loại
                    List<SurveyChartsResponseDTO.MultipleChoiceDataDTO> multipleChoiceList = new ArrayList<>();
                    List<SurveyChartsResponseDTO.MultipleChoiceDataDTO> singleChoiceList = new ArrayList<>();
                    List<SurveyChartsResponseDTO.MultipleChoiceDataDTO> rankingList = new ArrayList<>();
                    
                    for (SurveyChartsResponseDTO.MultipleChoiceDataDTO chartData : charts.getMultipleChoiceData()) {
                        Question question = questionRepository.findById(chartData.getQuestionId()).orElse(null);
                        if (question != null) {
                            if (question.getQuestionType() == QuestionTypeEnum.ranking) {
                                rankingList.add(chartData);
                            } else if (question.getQuestionType() == QuestionTypeEnum.single_choice) {
                                singleChoiceList.add(chartData);
                            } else {
                                multipleChoiceList.add(chartData);
                            }
                        } else {
                            // Mặc định là multiple choice nếu không tìm thấy
                            multipleChoiceList.add(chartData);
                        }
                    }
                    
                    // 1. Multiple Choice Charts
                    if (!multipleChoiceList.isEmpty()) {
                        com.itextpdf.layout.element.Paragraph chartsTitle = new com.itextpdf.layout.element.Paragraph(
                                "📊 Biểu đồ câu hỏi trắc nghiệm nhiều lựa chọn")
                                .setFont(fontBold)
                                .setFontSize(16)
                                .setMarginTop(20)
                                .setMarginBottom(10);
                        document.add(chartsTitle);
                        
                        for (SurveyChartsResponseDTO.MultipleChoiceDataDTO chartData : multipleChoiceList) {
                            addQuestionChartToPDF(document, chartData, "pie", font, fontBold, false);
                        }
                    }
                    
                    // 2. Single Choice Charts
                    if (!singleChoiceList.isEmpty()) {
                        com.itextpdf.layout.element.Paragraph chartsTitle = new com.itextpdf.layout.element.Paragraph(
                                "📊 Biểu đồ câu hỏi trắc nghiệm một lựa chọn")
                                .setFont(fontBold)
                                .setFontSize(16)
                                .setMarginTop(20)
                                .setMarginBottom(10);
                        document.add(chartsTitle);
                        
                        for (SurveyChartsResponseDTO.MultipleChoiceDataDTO chartData : singleChoiceList) {
                            addQuestionChartToPDF(document, chartData, "pie", font, fontBold, false);
                        }
                    }
                    
                    // 3. Ranking Charts
                    if (!rankingList.isEmpty()) {
                        com.itextpdf.layout.element.Paragraph chartsTitle = new com.itextpdf.layout.element.Paragraph(
                                "📊 Biểu đồ câu hỏi xếp hạng")
                                .setFont(fontBold)
                                .setFontSize(16)
                                .setMarginTop(20)
                                .setMarginBottom(10);
                        document.add(chartsTitle);
                        
                        for (SurveyChartsResponseDTO.MultipleChoiceDataDTO chartData : rankingList) {
                            addQuestionChartToPDF(document, chartData, "bar", font, fontBold, true);
                        }
                    }
                }

                // Rating Charts
                if (charts.getRatingData() != null && !charts.getRatingData().isEmpty()) {
                    com.itextpdf.layout.element.Paragraph ratingTitle = new com.itextpdf.layout.element.Paragraph(
                            "⭐ Biểu đồ câu hỏi đánh giá (Rating)")
                            .setFont(fontBold)
                            .setFontSize(16)
                            .setMarginTop(20)
                            .setMarginBottom(10);
                    document.add(ratingTitle);

                    for (SurveyChartsResponseDTO.RatingDataDTO ratingData : charts.getRatingData()) {
                        com.itextpdf.layout.element.Paragraph questionTitle = new com.itextpdf.layout.element.Paragraph(
                                ratingData.getQuestionText() != null ? ratingData.getQuestionText() : "Câu hỏi")
                                .setFont(fontBold)
                                .setFontSize(12)
                                .setMarginTop(15)
                                .setMarginBottom(5);
                        document.add(questionTitle);

                        // Thông tin rating
                        com.itextpdf.layout.element.Paragraph ratingInfo = new com.itextpdf.layout.element.Paragraph(
                                String.format("Đánh giá trung bình: %.2f", ratingData.getAverageRating()))
                                .setFont(font)
                                .setFontSize(10)
                                .setMarginBottom(10);
                        document.add(ratingInfo);

                        // Vẽ biểu đồ rating
                        if (ratingData.getDistribution() != null && !ratingData.getDistribution().isEmpty()) {
                            byte[] chartImage = createRatingBarChart(ratingData.getDistribution(),
                                    ratingData.getQuestionText() != null ? ratingData.getQuestionText() : "Biểu đồ");
                            if (chartImage != null) {
                                com.itextpdf.io.image.ImageData imageData = com.itextpdf.io.image.ImageDataFactory
                                        .create(chartImage);
                                com.itextpdf.layout.element.Image image = new com.itextpdf.layout.element.Image(
                                        imageData);
                                image.setWidth(480);
                                image.setAutoScale(true);
                                document.add(image);
                            }
                            
                            // Thêm bảng thống kê rating chi tiết
                            addRatingStatsTable(document, ratingData.getDistribution(), ratingData.getAverageRating(), font, fontBold);
                        }
                    }
                }

                // Boolean Charts
                if (charts.getBooleanData() != null && !charts.getBooleanData().isEmpty()) {
                    com.itextpdf.layout.element.Paragraph booleanTitle = new com.itextpdf.layout.element.Paragraph(
                            "✅ Biểu đồ câu hỏi Đúng/Sai (Yes/No)")
                            .setFont(fontBold)
                            .setFontSize(16)
                            .setMarginTop(20)
                            .setMarginBottom(10);
                    document.add(booleanTitle);

                    for (SurveyChartsResponseDTO.BooleanDataDTO booleanData : charts.getBooleanData()) {
                        com.itextpdf.layout.element.Paragraph questionTitle = new com.itextpdf.layout.element.Paragraph(
                                booleanData.getQuestionText() != null ? booleanData.getQuestionText() : "Câu hỏi")
                                .setFont(fontBold)
                                .setFontSize(12)
                                .setMarginTop(15)
                                .setMarginBottom(5);
                        document.add(questionTitle);

                        // Vẽ biểu đồ boolean
                        byte[] chartImage = createBooleanPieChart(booleanData);
                        if (chartImage != null) {
                            com.itextpdf.io.image.ImageData imageData = com.itextpdf.io.image.ImageDataFactory
                                    .create(chartImage);
                            com.itextpdf.layout.element.Image image = new com.itextpdf.layout.element.Image(imageData);
                            image.setWidth(480);
                            image.setAutoScale(true);
                            document.add(image);
                        }
                        
                        // Thêm bảng thống kê boolean chi tiết
                        addBooleanStatsTable(document, booleanData, font, fontBold);
                    }
                }
                
                // Open-Ended Questions (Text Responses)
                addOpenEndedQuestionsToPDF(document, surveyId, font, fontBold);

                // Timeline Charts
                if (timeline != null && timeline.getDaily() != null && !timeline.getDaily().isEmpty()) {
                    com.itextpdf.layout.element.Paragraph timelineTitle = new com.itextpdf.layout.element.Paragraph(
                            "📈 Biểu đồ xu hướng phản hồi theo thời gian")
                            .setFont(fontBold)
                            .setFontSize(16)
                            .setMarginTop(20)
                            .setMarginBottom(10);
                    document.add(timelineTitle);

                    // Vẽ biểu đồ daily timeline
                    byte[] timelineChartImage = createTimelineLineChart(timeline.getDaily());
                    if (timelineChartImage != null) {
                        com.itextpdf.io.image.ImageData imageData = com.itextpdf.io.image.ImageDataFactory
                                .create(timelineChartImage);
                        com.itextpdf.layout.element.Image image = new com.itextpdf.layout.element.Image(imageData);
                        image.setWidth(450);
                        image.setAutoScale(true);
                        document.add(image);
                    }
                    
                    // Thêm bảng thống kê timeline chi tiết
                    addTimelineStatsTable(document, timeline.getDaily(), font, fontBold);
                }

                // Sentiment Charts
                if (sentiment != null && sentiment.getOverall() != null) {
                    SurveySentimentResponseDTO.SentimentOverallDTO overall = sentiment.getOverall();
                    // Chỉ export nếu có ít nhất một giá trị > 0
                    if ((overall.getPositive() != null && overall.getPositive() > 0) ||
                            (overall.getNeutral() != null && overall.getNeutral() > 0) ||
                            (overall.getNegative() != null && overall.getNegative() > 0)) {
                        
                        com.itextpdf.layout.element.Paragraph sentimentTitle = new com.itextpdf.layout.element.Paragraph(
                                "😊 Biểu đồ phân tích cảm xúc (Sentiment Analysis)")
                                .setFont(fontBold)
                                .setFontSize(16)
                                .setMarginTop(20)
                                .setMarginBottom(10);
                        document.add(sentimentTitle);

                        // Vẽ biểu đồ sentiment overall
                        byte[] sentimentChartImage = createSentimentPieChart(overall);
                        if (sentimentChartImage != null) {
                            com.itextpdf.io.image.ImageData imageData = com.itextpdf.io.image.ImageDataFactory
                                    .create(sentimentChartImage);
                            com.itextpdf.layout.element.Image image = new com.itextpdf.layout.element.Image(imageData);
                            image.setWidth(480);
                            image.setAutoScale(true);
                            document.add(image);
                        }

                        // Thêm bảng thống kê sentiment chi tiết
                        addSentimentStatsTable(document, overall, font, fontBold);
                    }
                }
            }

            // Footer
            com.itextpdf.layout.element.Paragraph footer = new com.itextpdf.layout.element.Paragraph(
                    String.format("Xuất báo cáo ngày: %s",
                            LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))))
                    .setFont(font)
                    .setFontSize(8)
                    .setMarginTop(30);
            document.add(footer);

            document.close();
            pdfDoc.close();

            // Lấy byte array từ ByteArrayOutputStream
            return baos.toByteArray();

        } catch (Exception e) {
            log.error("Lỗi khi tạo PDF báo cáo: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể tạo PDF báo cáo: " + e.getMessage(), e);
        }
    }

    /**
     * Thêm một dòng vào bảng
     */
    private void addTableRow(com.itextpdf.layout.element.Table table, String label, String value,
            com.itextpdf.kernel.font.PdfFont font, com.itextpdf.kernel.font.PdfFont fontBold) {
        com.itextpdf.layout.element.Cell labelCell = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph(label).setFont(fontBold));
        com.itextpdf.layout.element.Cell valueCell = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph(value).setFont(font));
        table.addCell(labelCell);
        table.addCell(valueCell);
    }

    /**
     * Thêm bảng thống kê chi tiết cho Multiple Choice Chart
     */
    private void addMultipleChoiceStatsTable(com.itextpdf.layout.Document document,
            List<SurveyChartsResponseDTO.MultipleChoiceDataDTO.ChartDataDTO> chartData,
            com.itextpdf.kernel.font.PdfFont font, com.itextpdf.kernel.font.PdfFont fontBold) {
        if (chartData == null || chartData.isEmpty()) {
            return;
        }

        // Tính tổng
        int total = chartData.stream()
                .mapToInt(d -> d.getCount() != null ? d.getCount() : 0)
                .sum();

        if (total == 0) {
            return;
        }

        // Tạo bảng
        float[] columnWidths = {3, 1, 1};
        com.itextpdf.layout.element.Table statsTable = new com.itextpdf.layout.element.Table(columnWidths);
        statsTable.setWidth(480);
        statsTable.setMarginTop(10);
        statsTable.setMarginBottom(15);

        // Header
        com.itextpdf.layout.element.Cell header1 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Tùy chọn").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell header2 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Số lượng").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell header3 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Tỷ lệ (%)").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        statsTable.addHeaderCell(header1);
        statsTable.addHeaderCell(header2);
        statsTable.addHeaderCell(header3);

        // Data rows - sắp xếp theo count giảm dần
        List<SurveyChartsResponseDTO.MultipleChoiceDataDTO.ChartDataDTO> sortedData = new ArrayList<>(chartData);
        sortedData.sort((a, b) -> {
            int countA = a.getCount() != null ? a.getCount() : 0;
            int countB = b.getCount() != null ? b.getCount() : 0;
            return Integer.compare(countB, countA);
        });

        for (SurveyChartsResponseDTO.MultipleChoiceDataDTO.ChartDataDTO data : sortedData) {
            String option = data.getOption() != null ? data.getOption() : "N/A";
            int count = data.getCount() != null ? data.getCount() : 0;
            double percentage = data.getPercentage() != null ? data.getPercentage() : 0.0;

            com.itextpdf.layout.element.Cell cell1 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(option).setFont(font))
                    .setPadding(5);
            com.itextpdf.layout.element.Cell cell2 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.valueOf(count)).setFont(font))
                    .setPadding(5);
            com.itextpdf.layout.element.Cell cell3 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.format("%.2f%%", percentage)).setFont(font))
                    .setPadding(5);

            statsTable.addCell(cell1);
            statsTable.addCell(cell2);
            statsTable.addCell(cell3);
        }

        // Footer row - Tổng
        com.itextpdf.layout.element.Cell footer1 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Tổng").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell footer2 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph(String.valueOf(total)).setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell footer3 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("100.00%").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        statsTable.addCell(footer1);
        statsTable.addCell(footer2);
        statsTable.addCell(footer3);

        document.add(statsTable);
    }

    /**
     * Thêm bảng thống kê chi tiết cho Rating Chart
     */
    private void addRatingStatsTable(com.itextpdf.layout.Document document,
            java.util.Map<String, Integer> distribution, Double averageRating,
            com.itextpdf.kernel.font.PdfFont font, com.itextpdf.kernel.font.PdfFont fontBold) {
        if (distribution == null || distribution.isEmpty()) {
            return;
        }

        // Tính tổng
        int total = distribution.values().stream()
                .mapToInt(count -> count != null ? count : 0)
                .sum();

        if (total == 0) {
            return;
        }

        // Tạo bảng
        float[] columnWidths = {2, 1, 1};
        com.itextpdf.layout.element.Table statsTable = new com.itextpdf.layout.element.Table(columnWidths);
        statsTable.setWidth(480);
        statsTable.setMarginTop(10);
        statsTable.setMarginBottom(15);

        // Header
        com.itextpdf.layout.element.Cell header1 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Đánh giá").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell header2 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Số lượng").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell header3 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Tỷ lệ (%)").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        statsTable.addHeaderCell(header1);
        statsTable.addHeaderCell(header2);
        statsTable.addHeaderCell(header3);

        // Data rows - sắp xếp từ cao xuống thấp (5 sao -> 1 sao)
        List<java.util.Map.Entry<String, Integer>> sortedEntries = new ArrayList<>(distribution.entrySet());
        sortedEntries.sort((a, b) -> {
            try {
                int ratingA = Integer.parseInt(a.getKey());
                int ratingB = Integer.parseInt(b.getKey());
                return Integer.compare(ratingB, ratingA); // Giảm dần
            } catch (NumberFormatException e) {
                return a.getKey().compareTo(b.getKey());
            }
        });

        for (java.util.Map.Entry<String, Integer> entry : sortedEntries) {
            String rating = entry.getKey() + " sao";
            int count = entry.getValue() != null ? entry.getValue() : 0;
            double percentage = total > 0 ? (double) count / total * 100 : 0.0;

            com.itextpdf.layout.element.Cell cell1 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(rating).setFont(font))
                    .setPadding(5);
            com.itextpdf.layout.element.Cell cell2 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.valueOf(count)).setFont(font))
                    .setPadding(5);
            com.itextpdf.layout.element.Cell cell3 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.format("%.2f%%", percentage)).setFont(font))
                    .setPadding(5);

            statsTable.addCell(cell1);
            statsTable.addCell(cell2);
            statsTable.addCell(cell3);
        }

        // Footer row - Tổng và Average
        com.itextpdf.layout.element.Cell footer1 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Tổng / Trung bình").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell footer2 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph(String.valueOf(total)).setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell footer3 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph(
                        averageRating != null ? String.format("%.2f", averageRating) : "N/A")
                        .setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        statsTable.addCell(footer1);
        statsTable.addCell(footer2);
        statsTable.addCell(footer3);

        document.add(statsTable);
    }

    /**
     * Thêm bảng thống kê chi tiết cho Boolean Chart
     */
    private void addBooleanStatsTable(com.itextpdf.layout.Document document,
            SurveyChartsResponseDTO.BooleanDataDTO booleanData,
            com.itextpdf.kernel.font.PdfFont font, com.itextpdf.kernel.font.PdfFont fontBold) {
        int trueCount = booleanData.getTrueCount() != null ? booleanData.getTrueCount() : 0;
        int falseCount = booleanData.getFalseCount() != null ? booleanData.getFalseCount() : 0;
        int total = trueCount + falseCount;

        if (total == 0) {
            return;
        }

        double truePercent = booleanData.getTruePercentage() != null ? booleanData.getTruePercentage() : 0.0;
        double falsePercent = 100.0 - truePercent;

        // Tạo bảng
        float[] columnWidths = {2, 1, 1};
        com.itextpdf.layout.element.Table statsTable = new com.itextpdf.layout.element.Table(columnWidths);
        statsTable.setWidth(480);
        statsTable.setMarginTop(10);
        statsTable.setMarginBottom(15);

        // Header
        com.itextpdf.layout.element.Cell header1 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Lựa chọn").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell header2 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Số lượng").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell header3 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Tỷ lệ (%)").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        statsTable.addHeaderCell(header1);
        statsTable.addHeaderCell(header2);
        statsTable.addHeaderCell(header3);

        // Data rows
        if (trueCount > 0) {
            com.itextpdf.layout.element.Cell cell1 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph("Có / Đúng").setFont(font))
                    .setPadding(5);
            com.itextpdf.layout.element.Cell cell2 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.valueOf(trueCount)).setFont(font))
                    .setPadding(5);
            com.itextpdf.layout.element.Cell cell3 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.format("%.2f%%", truePercent)).setFont(font))
                    .setPadding(5);
            statsTable.addCell(cell1);
            statsTable.addCell(cell2);
            statsTable.addCell(cell3);
        }

        if (falseCount > 0) {
            com.itextpdf.layout.element.Cell cell1 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph("Không / Sai").setFont(font))
                    .setPadding(5);
            com.itextpdf.layout.element.Cell cell2 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.valueOf(falseCount)).setFont(font))
                    .setPadding(5);
            com.itextpdf.layout.element.Cell cell3 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.format("%.2f%%", falsePercent)).setFont(font))
                    .setPadding(5);
            statsTable.addCell(cell1);
            statsTable.addCell(cell2);
            statsTable.addCell(cell3);
        }

        // Footer row - Tổng
        com.itextpdf.layout.element.Cell footer1 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Tổng").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell footer2 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph(String.valueOf(total)).setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell footer3 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("100.00%").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        statsTable.addCell(footer1);
        statsTable.addCell(footer2);
        statsTable.addCell(footer3);

        document.add(statsTable);
    }

    /**
     * Thêm bảng thống kê chi tiết cho Timeline Chart - Thiết kế đẹp và dễ phân tích
     */
    private void addTimelineStatsTable(com.itextpdf.layout.Document document,
            List<SurveyTimelineResponseDTO.DailyDataDTO> dailyData,
            com.itextpdf.kernel.font.PdfFont font, com.itextpdf.kernel.font.PdfFont fontBold) {
        if (dailyData == null || dailyData.isEmpty()) {
            return;
        }

        // Sắp xếp theo date
        List<SurveyTimelineResponseDTO.DailyDataDTO> sortedData = new ArrayList<>(dailyData);
        sortedData.sort((a, b) -> {
            if (a.getDate() == null || b.getDate() == null) return 0;
            return a.getDate().compareTo(b.getDate());
        });

        // Tính tổng
        int totalCount = sortedData.stream()
                .mapToInt(d -> d.getCount() != null ? d.getCount() : 0)
                .sum();
        int totalCompleted = sortedData.stream()
                .mapToInt(d -> d.getCompleted() != null ? d.getCompleted() : 0)
                .sum();
        int totalPartial = totalCount - totalCompleted;

        // Tạo bảng với 5 cột: Ngày, Tổng số, Hoàn thành, Chưa hoàn thành, Tỷ lệ
        float[] columnWidths = {2.5f, 1.2f, 1.2f, 1.5f, 1.2f};
        com.itextpdf.layout.element.Table statsTable = new com.itextpdf.layout.element.Table(columnWidths);
        statsTable.setWidth(480);
        statsTable.setMarginTop(10);
        statsTable.setMarginBottom(15);

        // Header với style giống các bảng khác (màu xám nhạt)
        com.itextpdf.layout.element.Cell header1 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Ngày").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5)
                .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);
        
        com.itextpdf.layout.element.Cell header2 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Tổng số").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5)
                .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);
        
        com.itextpdf.layout.element.Cell header3 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Hoàn thành").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5)
                .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);
        
        com.itextpdf.layout.element.Cell header4 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Chưa hoàn thành").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5)
                .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);
        
        com.itextpdf.layout.element.Cell header5 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Tỷ lệ HT").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5)
                .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);
        
        statsTable.addHeaderCell(header1);
        statsTable.addHeaderCell(header2);
        statsTable.addHeaderCell(header3);
        statsTable.addHeaderCell(header4);
        statsTable.addHeaderCell(header5);

        // Data rows với styling giống các bảng khác (nền trắng)
        for (SurveyTimelineResponseDTO.DailyDataDTO data : sortedData) {
            String date = data.getDate() != null ? data.getDate() : "N/A";
            int count = data.getCount() != null ? data.getCount() : 0;
            int completed = data.getCompleted() != null ? data.getCompleted() : 0;
            int partial = data.getPartial() != null ? data.getPartial() : 0;
            
            // Tính tỷ lệ hoàn thành
            double completionRate = count > 0 ? (double) completed / count * 100 : 0.0;

            // Format date đẹp hơn: dd/MM/yyyy
            String displayDate = date;
            try {
                if (date.length() >= 10) {
                    // Format từ YYYY-MM-DD sang dd/MM/yyyy
                    String year = date.substring(0, 4);
                    String month = date.substring(5, 7);
                    String day = date.substring(8, 10);
                    displayDate = day + "/" + month + "/" + year;
                }
            } catch (Exception e) {
                // Giữ nguyên nếu format lỗi
            }

            // Cell 1: Ngày
            com.itextpdf.layout.element.Cell cell1 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(displayDate).setFont(font))
                    .setPadding(5)
                    .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.LEFT)
                    .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);

            // Cell 2: Tổng số
            com.itextpdf.layout.element.Cell cell2 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.valueOf(count)).setFont(font))
                    .setPadding(5)
                    .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                    .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);

            // Cell 3: Hoàn thành (màu đen)
            com.itextpdf.layout.element.Cell cell3 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.valueOf(completed)).setFont(font))
                    .setPadding(5)
                    .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                    .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);

            // Cell 4: Chưa hoàn thành (màu đen)
            com.itextpdf.layout.element.Cell cell4 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.valueOf(partial)).setFont(font))
                    .setPadding(5)
                    .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                    .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);

            // Cell 5: Tỷ lệ hoàn thành
            com.itextpdf.layout.element.Cell cell5 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.format("%.1f%%", completionRate)).setFont(font))
                    .setPadding(5)
                    .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                    .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);

            statsTable.addCell(cell1);
            statsTable.addCell(cell2);
            statsTable.addCell(cell3);
            statsTable.addCell(cell4);
            statsTable.addCell(cell5);
        }

        // Footer row - Tổng với style giống các bảng khác (màu xám nhạt)
        double totalCompletionRate = totalCount > 0 ? (double) totalCompleted / totalCount * 100 : 0.0;
        
        com.itextpdf.layout.element.Cell footer1 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("TỔNG CỘNG").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5)
                .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);
        
        com.itextpdf.layout.element.Cell footer2 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph(String.valueOf(totalCount)).setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5)
                .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);
        
        com.itextpdf.layout.element.Cell footer3 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph(String.valueOf(totalCompleted)).setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5)
                .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);
        
        com.itextpdf.layout.element.Cell footer4 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph(String.valueOf(totalPartial)).setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5)
                .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);
        
        com.itextpdf.layout.element.Cell footer5 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph(String.format("%.1f%%", totalCompletionRate)).setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5)
                .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);
        
        statsTable.addCell(footer1);
        statsTable.addCell(footer2);
        statsTable.addCell(footer3);
        statsTable.addCell(footer4);
        statsTable.addCell(footer5);

        document.add(statsTable);
    }

    /**
     * Thêm bảng thống kê chi tiết cho Sentiment Chart
     */
    private void addSentimentStatsTable(com.itextpdf.layout.Document document,
            SurveySentimentResponseDTO.SentimentOverallDTO overall,
            com.itextpdf.kernel.font.PdfFont font, com.itextpdf.kernel.font.PdfFont fontBold) {
        double positive = overall.getPositive() != null ? overall.getPositive() : 0.0;
        double neutral = overall.getNeutral() != null ? overall.getNeutral() : 0.0;
        double negative = overall.getNegative() != null ? overall.getNegative() : 0.0;
        double total = positive + neutral + negative;

        if (total == 0) {
            return;
        }

        // Tạo bảng
        float[] columnWidths = {2, 1};
        com.itextpdf.layout.element.Table statsTable = new com.itextpdf.layout.element.Table(columnWidths);
        statsTable.setWidth(480);
        statsTable.setMarginTop(10);
        statsTable.setMarginBottom(15);

        // Header
        com.itextpdf.layout.element.Cell header1 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Loại cảm xúc").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell header2 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Tỷ lệ (%)").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        statsTable.addHeaderCell(header1);
        statsTable.addHeaderCell(header2);

        // Data rows
        if (positive > 0) {
            com.itextpdf.layout.element.Cell cell1 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph("Tích cực").setFont(font))
                    .setPadding(5);
            com.itextpdf.layout.element.Cell cell2 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.format("%.2f%%", positive)).setFont(font))
                    .setPadding(5);
            statsTable.addCell(cell1);
            statsTable.addCell(cell2);
        }

        if (neutral > 0) {
            com.itextpdf.layout.element.Cell cell1 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph("Trung tính").setFont(font))
                    .setPadding(5);
            com.itextpdf.layout.element.Cell cell2 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.format("%.2f%%", neutral)).setFont(font))
                    .setPadding(5);
            statsTable.addCell(cell1);
            statsTable.addCell(cell2);
        }

        if (negative > 0) {
            com.itextpdf.layout.element.Cell cell1 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph("Tiêu cực").setFont(font))
                    .setPadding(5);
            com.itextpdf.layout.element.Cell cell2 = new com.itextpdf.layout.element.Cell()
                    .add(new com.itextpdf.layout.element.Paragraph(String.format("%.2f%%", negative)).setFont(font))
                    .setPadding(5);
            statsTable.addCell(cell1);
            statsTable.addCell(cell2);
        }

        // Footer row - Tổng
        com.itextpdf.layout.element.Cell footer1 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph("Tổng").setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        com.itextpdf.layout.element.Cell footer2 = new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph(String.format("%.2f%%", total)).setFont(fontBold))
                .setBackgroundColor(com.itextpdf.kernel.colors.ColorConstants.LIGHT_GRAY)
                .setPadding(5);
        statsTable.addCell(footer1);
        statsTable.addCell(footer2);

        document.add(statsTable);
    }

    /**
     * Tạo biểu đồ Pie cho Multiple Choice
     */
    private byte[] createPieChart(List<SurveyChartsResponseDTO.MultipleChoiceDataDTO.ChartDataDTO> chartData,
            String title) {
        try {
            if (chartData == null || chartData.isEmpty()) {
                log.warn("Chart data is empty for pie chart: {}", title);
                return null;
            }

            org.jfree.data.general.DefaultPieDataset<String> dataset = new org.jfree.data.general.DefaultPieDataset<>();
            for (SurveyChartsResponseDTO.MultipleChoiceDataDTO.ChartDataDTO data : chartData) {
                String optionText = data.getOption() != null ? data.getOption() : "N/A";
                int count = data.getCount() != null ? data.getCount() : 0;
                if (count > 0) { // Chỉ thêm vào dataset nếu có count > 0
                    dataset.setValue(optionText, count);
                }
            }

            if (dataset.getItemCount() == 0) {
                log.warn("No valid data in dataset for pie chart: {}", title);
                return null;
            }

            // Không set title trong chart vì đã có title dạng Paragraph trong PDF
            org.jfree.chart.JFreeChart chart = org.jfree.chart.ChartFactory.createPieChart(
                    null, // Không có title trong biểu đồ
                    dataset,
                    true, // legend
                    true, // tooltips
                    false // URLs
            );

            byte[] result = chartToByteArray(chart, 500, 400);
            if (result == null) {
                log.error("Failed to convert pie chart to byte array: {}", title);
            }
            return result;
        } catch (Exception e) {
            log.error("Lỗi khi tạo pie chart: {}", e.getMessage(), e);
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Tạo biểu đồ Bar cho Multiple Choice (Ranking)
     * @param isRanking true nếu là ranking question (dùng percentage), false nếu là multiple choice (dùng count)
     */
    private byte[] createMultipleChoiceBarChart(List<SurveyChartsResponseDTO.MultipleChoiceDataDTO.ChartDataDTO> chartData,
            String title, boolean isRanking) {
        try {
            if (chartData == null || chartData.isEmpty()) {
                log.warn("Chart data is empty for multiple choice bar chart: {}", title);
                return null;
            }

            org.jfree.data.category.DefaultCategoryDataset dataset = new org.jfree.data.category.DefaultCategoryDataset();
            for (SurveyChartsResponseDTO.MultipleChoiceDataDTO.ChartDataDTO data : chartData) {
                // Với ranking: dùng percentage, với multiple choice: dùng count
                double value;
                String valueLabel;
                if (isRanking) {
                    value = data.getPercentage() != null ? data.getPercentage() : 0.0;
                    valueLabel = "Điểm ưu tiên (%)";
                } else {
                    value = data.getCount() != null ? data.getCount() : 0;
                    valueLabel = "Số lượng";
                }
                
                if (value > 0) {
                    dataset.addValue(value, 
                            valueLabel, 
                            data.getOption() != null ? data.getOption() : "N/A");
                }
            }

            if (dataset.getRowCount() == 0) {
                log.warn("No valid data in dataset for multiple choice bar chart: {}", title);
                return null;
            }


            org.jfree.chart.JFreeChart chart = org.jfree.chart.ChartFactory.createBarChart(
                    "",
                    "Tùy chọn",
                    isRanking ? "Điểm ưu tiên (%)" : "Điểm số",
                    dataset,
                    org.jfree.chart.plot.PlotOrientation.VERTICAL,
                    true, // legend
                    true, // tooltips
                    false // URLs
            );

            byte[] result = chartToByteArray(chart, 500, 400);
            if (result == null) {
                log.error("Failed to convert multiple choice bar chart to byte array: {}", title);
            }
            return result;
        } catch (Exception e) {
            log.error("Lỗi khi tạo multiple choice bar chart: {}", e.getMessage(), e);
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Tạo biểu đồ Bar cho Rating
     */
    private byte[] createRatingBarChart(java.util.Map<String, Integer> distribution, String title) {
        try {
            if (distribution == null || distribution.isEmpty()) {
                log.warn("Distribution is empty for rating bar chart: {}", title);
                return null;
            }

            org.jfree.data.category.DefaultCategoryDataset dataset = new org.jfree.data.category.DefaultCategoryDataset();
            for (java.util.Map.Entry<String, Integer> entry : distribution.entrySet()) {
                if (entry.getValue() != null && entry.getValue() > 0) {
                    dataset.addValue(entry.getValue(), "Số lượng", entry.getKey());
                }
            }

            if (dataset.getRowCount() == 0) {
                log.warn("No valid data in dataset for rating bar chart: {}", title);
                return null;
            }

        
            org.jfree.chart.JFreeChart chart = org.jfree.chart.ChartFactory.createBarChart(
                    "",
                    "Đánh giá",
                    "Số lượng",
                    dataset,
                    org.jfree.chart.plot.PlotOrientation.VERTICAL,
                    false, // legend
                    true, // tooltips
                    false // URLs
            );

            byte[] result = chartToByteArray(chart, 500, 400);
            if (result == null) {
                log.error("Failed to convert rating bar chart to byte array: {}", title);
            }
            return result;
        } catch (Exception e) {
            log.error("Lỗi khi tạo bar chart: {}", e.getMessage(), e);
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Tạo biểu đồ Pie cho Boolean
     */
    private byte[] createBooleanPieChart(SurveyChartsResponseDTO.BooleanDataDTO booleanData) {
        try {
            int trueCount = booleanData.getTrueCount() != null ? booleanData.getTrueCount() : 0;
            int falseCount = booleanData.getFalseCount() != null ? booleanData.getFalseCount() : 0;
            
            if (trueCount == 0 && falseCount == 0) {
                log.warn("No data for boolean chart");
                return null;
            }

            org.jfree.data.general.DefaultPieDataset<String> dataset = new org.jfree.data.general.DefaultPieDataset<>();
            if (trueCount > 0) {
                dataset.setValue("Có", trueCount);
            }
            if (falseCount > 0) {
                dataset.setValue("Không", falseCount);
            }

         
            org.jfree.chart.JFreeChart chart = org.jfree.chart.ChartFactory.createPieChart(
                    "",
                    dataset,
                    true, // legend
                    true, // tooltips
                    false // URLs
            );

            byte[] result = chartToByteArray(chart, 500, 400);
            if (result == null) {
                log.error("Failed to convert boolean pie chart to byte array");
            }
            return result;
        } catch (Exception e) {
            log.error("Lỗi khi tạo boolean pie chart: {}", e.getMessage(), e);
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Tạo biểu đồ Line cho Timeline (Daily data)
     */
    private byte[] createTimelineLineChart(List<SurveyTimelineResponseDTO.DailyDataDTO> dailyData) {
        try {
            if (dailyData == null || dailyData.isEmpty()) {
                log.warn("Daily data is empty for timeline chart");
                return null;
            }

            org.jfree.data.category.DefaultCategoryDataset dataset = new org.jfree.data.category.DefaultCategoryDataset();
            
            // Sắp xếp theo date để đảm bảo thứ tự
            List<SurveyTimelineResponseDTO.DailyDataDTO> sortedData = new ArrayList<>(dailyData);
            sortedData.sort((a, b) -> {
                if (a.getDate() == null || b.getDate() == null) return 0;
                return a.getDate().compareTo(b.getDate());
            });

            for (SurveyTimelineResponseDTO.DailyDataDTO data : sortedData) {
                String date = data.getDate() != null ? data.getDate() : "N/A";
                int count = data.getCount() != null ? data.getCount() : 0;
                int completed = data.getCompleted() != null ? data.getCompleted() : 0;
                
                // Format date để hiển thị ngắn gọn hơn (chỉ lấy ngày/tháng)
                String displayDate = date;
                if (date != null && date.length() >= 10 && !date.equals("N/A")) {
                    try {
                        // Kiểm tra format "yyyy-MM-dd"
                        if (date.matches("\\d{4}-\\d{2}-\\d{2}")) {
                            displayDate = date.substring(5, 10); // Lấy "MM-DD"
                        } else {
                            displayDate = date; // Giữ nguyên nếu format khác
                        }
                    } catch (Exception e) {
                        displayDate = date; // Giữ nguyên nếu có lỗi
                    }
                }
                
                // Log để debug
                log.debug("Timeline chart data - Date: {}, Tổng số: {}, Hoàn thành: {}", displayDate, count, completed);
                
                // Chuyển đổi sang double để đảm bảo JFreeChart nhận đúng kiểu dữ liệu
                // Luôn thêm cả hai series, ngay cả khi giá trị = 0 để đảm bảo hiển thị đầy đủ
                dataset.addValue((double) count, "Tổng số", displayDate);
                dataset.addValue((double) completed, "Hoàn thành", displayDate);
            }

            if (dataset.getRowCount() == 0) {
                log.warn("No valid data in dataset for timeline chart");
                return null;
            }

            org.jfree.chart.JFreeChart chart = org.jfree.chart.ChartFactory.createLineChart(
                "Xu hướng phản hồi theo ngày", // Thêm title vào đây
                "Ngày",
                "Số lượng",
                dataset,
                org.jfree.chart.plot.PlotOrientation.VERTICAL,
                true, // legend
                true, // tooltips
                false // URLs
            );
            
            // ========== CẢI THIỆN STYLING CHO BIỂU ĐỒ ĐẸP HƠN ==========
            
            // Cấu hình title
            org.jfree.chart.title.TextTitle chartTitle = chart.getTitle();
            if (chartTitle != null) {
                chartTitle.setFont(new java.awt.Font("Arial", java.awt.Font.BOLD, 16));
                chartTitle.setPaint(new java.awt.Color(52, 73, 94)); // Màu xám đậm đẹp
            }
            
            // Cấu hình plot
            org.jfree.chart.plot.CategoryPlot plot = (org.jfree.chart.plot.CategoryPlot) chart.getPlot();
            plot.setBackgroundPaint(java.awt.Color.WHITE);
            plot.setRangeGridlinePaint(new java.awt.Color(220, 220, 220)); // Grid line màu xám nhạt
            plot.setRangeGridlinesVisible(true);
            plot.setDomainGridlinesVisible(false);
            
            // Cấu hình renderer với màu sắc đẹp và chuyên nghiệp
            org.jfree.chart.renderer.category.LineAndShapeRenderer renderer = 
                (org.jfree.chart.renderer.category.LineAndShapeRenderer) plot.getRenderer();
            
            // Đảm bảo line và shape được hiển thị
            renderer.setDefaultShapesVisible(true);
            renderer.setDefaultShapesFilled(true);
            renderer.setDefaultLinesVisible(true);
            
            // Màu sắc đẹp và chuyên nghiệp
            // "Tổng số" - màu xanh dương đẹp (Professional Blue)
            renderer.setSeriesPaint(0, new java.awt.Color(52, 152, 219)); 
            // "Hoàn thành" - màu xanh lá đẹp (Success Green)
            renderer.setSeriesPaint(1, new java.awt.Color(46, 204, 113));
            
            // Đặt độ dày của line (dày hơn để dễ nhìn)
            renderer.setDefaultStroke(new java.awt.BasicStroke(3.0f, 
                java.awt.BasicStroke.CAP_ROUND, java.awt.BasicStroke.JOIN_ROUND));
            
            // Cấu hình shape (điểm dữ liệu) lớn hơn và đẹp hơn
            // Sử dụng shape khác nhau để phân biệt rõ hai series
            // "Tổng số" - hình vuông
            renderer.setSeriesShape(0, new java.awt.geom.Rectangle2D.Double(-5, -5, 10, 10));
            // "Hoàn thành" - hình tròn
            renderer.setSeriesShape(1, new java.awt.geom.Ellipse2D.Double(-5, -5, 10, 10));
            
            // Đảm bảo cả hai series đều hiển thị rõ ràng
            renderer.setSeriesShapesVisible(0, true);
            renderer.setSeriesShapesVisible(1, true);
            renderer.setSeriesShapesFilled(0, true);
            renderer.setSeriesShapesFilled(1, true);
            
            // Cấu hình axis
            org.jfree.chart.axis.CategoryAxis domainAxis = plot.getDomainAxis();
            domainAxis.setLabelFont(new java.awt.Font("Arial", java.awt.Font.BOLD, 12));
            domainAxis.setTickLabelFont(new java.awt.Font("Arial", java.awt.Font.PLAIN, 10));
            domainAxis.setTickLabelPaint(new java.awt.Color(44, 62, 80));
            
            org.jfree.chart.axis.NumberAxis rangeAxis = (org.jfree.chart.axis.NumberAxis) plot.getRangeAxis();
            rangeAxis.setLabelFont(new java.awt.Font("Arial", java.awt.Font.BOLD, 12));
            rangeAxis.setTickLabelFont(new java.awt.Font("Arial", java.awt.Font.PLAIN, 10));
            rangeAxis.setTickLabelPaint(new java.awt.Color(44, 62, 80));
            rangeAxis.setStandardTickUnits(org.jfree.chart.axis.NumberAxis.createIntegerTickUnits());
            
            // Cấu hình legend đẹp hơn
            org.jfree.chart.title.LegendTitle legend = chart.getLegend();
            if (legend != null) {
                legend.setItemFont(new java.awt.Font("Arial", java.awt.Font.PLAIN, 11));
                legend.setBackgroundPaint(java.awt.Color.WHITE);
            }

            byte[] result = chartToByteArray(chart, 500, 400);
            if (result == null) {
                log.error("Failed to convert timeline chart to byte array");
            }
            return result;
        } catch (Exception e) {
            log.error("Lỗi khi tạo timeline chart: {}", e.getMessage(), e);
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Tạo biểu đồ Pie cho Sentiment Analysis
     */
    private byte[] createSentimentPieChart(SurveySentimentResponseDTO.SentimentOverallDTO overall) {
        try {
            double positive = overall.getPositive() != null ? overall.getPositive() : 0.0;
            double neutral = overall.getNeutral() != null ? overall.getNeutral() : 0.0;
            double negative = overall.getNegative() != null ? overall.getNegative() : 0.0;
            
            if (positive == 0 && neutral == 0 && negative == 0) {
                log.warn("No data for sentiment chart");
                return null;
            }

            org.jfree.data.general.DefaultPieDataset<String> dataset = new org.jfree.data.general.DefaultPieDataset<>();
            if (positive > 0) {
                dataset.setValue("Tích cực", positive);
            }
            if (neutral > 0) {
                dataset.setValue("Trung tính", neutral);
            }
            if (negative > 0) {
                dataset.setValue("Tiêu cực", negative);
            }

            if (dataset.getItemCount() == 0) {
                log.warn("No valid data in dataset for sentiment chart");
                return null;
            }

            org.jfree.chart.JFreeChart chart = org.jfree.chart.ChartFactory.createPieChart(
                    "Phân tích cảm xúc tổng quan",
                    dataset,
                    true, // legend
                    true, // tooltips
                    false // URLs
            );

            chart.setTitle(new org.jfree.chart.title.TextTitle(
                    "Phân tích cảm xúc tổng quan",
                    new java.awt.Font("Arial", java.awt.Font.BOLD, 14)));

            byte[] result = chartToByteArray(chart, 500, 400);
            if (result == null) {
                log.error("Failed to convert sentiment chart to byte array");
            }
            return result;
        } catch (Exception e) {
            log.error("Lỗi khi tạo sentiment chart: {}", e.getMessage(), e);
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Chuyển JFreeChart thành byte array (PNG)
     */
    private byte[] chartToByteArray(org.jfree.chart.JFreeChart chart, int width, int height) {
        try {
            // Đảm bảo headless mode
            System.setProperty("java.awt.headless", "true");
            
            // Tạo BufferedImage với type RGB để đảm bảo tương thích
            java.awt.image.BufferedImage image = new java.awt.image.BufferedImage(width, height, 
                    java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g2 = image.createGraphics();
            
            // Set rendering hints để có chất lượng tốt hơn
            g2.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, 
                    java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setRenderingHint(java.awt.RenderingHints.KEY_TEXT_ANTIALIASING, 
                    java.awt.RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            
            // Vẽ chart vào image
            chart.draw(g2, new java.awt.geom.Rectangle2D.Double(0, 0, width, height));
            g2.dispose();
            
            // Chuyển thành PNG
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(image, "PNG", baos);
            byte[] result = baos.toByteArray();
            
            log.debug("Chart converted successfully, size: {} bytes", result.length);
            return result;
        } catch (Exception e) {
            log.error("Lỗi khi chuyển chart thành image: {}", e.getMessage(), e);
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Helper method để thêm biểu đồ câu hỏi vào PDF
     * @param isRanking true nếu là ranking question, false nếu là multiple choice
     */
    private void addQuestionChartToPDF(com.itextpdf.layout.Document document,
            SurveyChartsResponseDTO.MultipleChoiceDataDTO chartData,
            String chartType,
            com.itextpdf.kernel.font.PdfFont font, com.itextpdf.kernel.font.PdfFont fontBold,
            boolean isRanking) {
        // Tiêu đề câu hỏi
        com.itextpdf.layout.element.Paragraph questionTitle = new com.itextpdf.layout.element.Paragraph(
                chartData.getQuestionText() != null ? chartData.getQuestionText() : "Câu hỏi")
                .setFont(fontBold)
                .setFontSize(12)
                .setMarginTop(15)
                .setMarginBottom(5);
        document.add(questionTitle);

        // Vẽ biểu đồ
        if (chartData.getChartData() != null && !chartData.getChartData().isEmpty()) {
            byte[] chartImage = null;
            
            if ("bar".equals(chartType)) {
                chartImage = createMultipleChoiceBarChart(chartData.getChartData(),
                        chartData.getQuestionText() != null ? chartData.getQuestionText() : "Biểu đồ",
                        isRanking);
            } else {
                chartImage = createPieChart(chartData.getChartData(),
                        chartData.getQuestionText() != null ? chartData.getQuestionText() : "Biểu đồ");
            }
            
            if (chartImage != null) {
                com.itextpdf.io.image.ImageData imageData = com.itextpdf.io.image.ImageDataFactory
                        .create(chartImage);
                com.itextpdf.layout.element.Image image = new com.itextpdf.layout.element.Image(imageData);
                image.setWidth(480);
                image.setAutoScale(true);
                document.add(image);
            }
            
            // Thêm bảng thống kê chi tiết
            addMultipleChoiceStatsTable(document, chartData.getChartData(), font, fontBold);
        }
    }

    /**
     * Thêm câu hỏi mở (Open-Ended) vào PDF
     */
    private void addOpenEndedQuestionsToPDF(com.itextpdf.layout.Document document,
            Long surveyId,
            com.itextpdf.kernel.font.PdfFont font, com.itextpdf.kernel.font.PdfFont fontBold) {
        try {
            Survey survey = surveyRepository.findById(surveyId).orElse(null);
            if (survey == null) {
                return;
            }

            // Lấy tất cả open-ended questions
            List<Question> openEndedQuestions = questionRepository.findBySurveyOrderByDisplayOrderAsc(survey)
                    .stream()
                    .filter(q -> q.getQuestionType() == QuestionTypeEnum.open_ended)
                    .collect(Collectors.toList());

            if (openEndedQuestions.isEmpty()) {
                return;
            }

            // Tiêu đề section
            com.itextpdf.layout.element.Paragraph openEndedTitle = new com.itextpdf.layout.element.Paragraph(
                    "📝 Câu hỏi mở (Open-Ended Questions)")
                    .setFont(fontBold)
                    .setFontSize(16)
                    .setMarginTop(20)
                    .setMarginBottom(10);
            document.add(openEndedTitle);

            // Xử lý từng câu hỏi
            for (Question question : openEndedQuestions) {
                // Tiêu đề câu hỏi
                com.itextpdf.layout.element.Paragraph questionTitle = new com.itextpdf.layout.element.Paragraph(
                        question.getQuestionText() != null ? question.getQuestionText() : "Câu hỏi")
                        .setFont(fontBold)
                        .setFontSize(12)
                        .setMarginTop(15)
                        .setMarginBottom(5);
                document.add(questionTitle);

                // Lấy tất cả answers
                List<Answer> answers = answerRepository.findByQuestion(question);
                List<Answer> validAnswers = answers.stream()
                        .filter(a -> a.getAnswerText() != null && !a.getAnswerText().trim().isEmpty())
                        .collect(Collectors.toList());

                if (validAnswers.isEmpty()) {
                    com.itextpdf.layout.element.Paragraph noAnswer = new com.itextpdf.layout.element.Paragraph(
                            "Chưa có câu trả lời")
                            .setFont(font)
                            .setFontSize(10)
                            .setFontColor(com.itextpdf.kernel.colors.ColorConstants.GRAY)
                            .setMarginBottom(10);
                    document.add(noAnswer);
                    continue;
                }

                // Thống kê
                int totalAnswers = validAnswers.size();

                com.itextpdf.layout.element.Paragraph stats = new com.itextpdf.layout.element.Paragraph(
                        String.format("Tổng số câu trả lời: %d", totalAnswers))
                        .setFont(font)
                        .setFontSize(10)
                        .setMarginBottom(10);
                document.add(stats);

                // Hiển thị các câu trả lời (giới hạn 10 câu đầu để không quá dài)
                int maxDisplay = Math.min(10, validAnswers.size());
                for (int i = 0; i < maxDisplay; i++) {
                    Answer answer = validAnswers.get(i);
                    com.itextpdf.layout.element.Paragraph answerText = new com.itextpdf.layout.element.Paragraph(
                            String.format("%d. %s", i + 1, answer.getAnswerText()))
                            .setFont(font)
                            .setFontSize(9)
                            .setMarginBottom(5)
                            .setPaddingLeft(10);
                    document.add(answerText);
                }

                if (validAnswers.size() > maxDisplay) {
                    com.itextpdf.layout.element.Paragraph moreText = new com.itextpdf.layout.element.Paragraph(
                            String.format("... và %d câu trả lời khác", validAnswers.size() - maxDisplay))
                            .setFont(font)
                            .setFontSize(9)
                            .setFontColor(com.itextpdf.kernel.colors.ColorConstants.GRAY)
                            .setMarginBottom(10);
                    document.add(moreText);
                }
            }
        } catch (Exception e) {
            log.error("Lỗi khi thêm open-ended questions vào PDF: {}", e.getMessage(), e);
        }
    }

}
