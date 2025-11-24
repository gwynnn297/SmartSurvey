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
            throw new IdInvalidException("Bạn không có quyền xem thống kê khảo sát này");
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
            throw new IdInvalidException("Bạn không có quyền xem thống kê khảo sát này");
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
            throw new IdInvalidException("Bạn không có quyền xem thống kê khảo sát này");
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
            throw new IdInvalidException("Bạn không có quyền xem thống kê khảo sát này");
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
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new IdInvalidException("Bạn không có quyền xem phân tích cảm xúc khảo sát này");
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

}
