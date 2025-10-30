package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.duytan.c1se09.smartsurvey.domain.*;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyOverviewResponseDTO;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyQuestionCountsDTO;
import vn.duytan.c1se09.smartsurvey.util.constant.QuestionTypeEnum;
import vn.duytan.c1se09.smartsurvey.domain.response.statistics.SurveyTimelineResponseDTO;
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
public class StatisticsService {
    
    private final SurveyRepository surveyRepository;
    private final ResponseRepository responseRepository;
    private final AnswerRepository answerRepository;
    private final OptionRepository optionRepository;
    private final QuestionRepository questionRepository;
    private final SurveyViewRepository surveyViewRepository;
    private final AuthService authService;
    
    /**
     * Lấy thống kê tổng quan của survey
     */
    public SurveyOverviewResponseDTO getSurveyOverview(Long surveyId) throws IdInvalidException {
        // Kiểm tra survey tồn tại và quyền truy cập
        Survey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy khảo sát"));
        
        User currentUser = authService.getCurrentUser();
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
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
        SurveyOverviewResponseDTO.CompletionStatsDTO completionStats = SurveyOverviewResponseDTO.CompletionStatsDTO.builder()
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
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
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
            if (t == null) continue;
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
        if (!survey.getUser().getUserId().equals(currentUser.getUserId())) {
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
                        .anyMatch(answer -> answer.getQuestion().getQuestionId().equals(requiredQuestion.getQuestionId()));
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
                        .anyMatch(answer -> answer.getQuestion().getQuestionId().equals(requiredQuestion.getQuestionId()));
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
    private SurveyOverviewResponseDTO.DemographicsDTO buildDemographicsIfAvailable(Survey survey, List<Response> responses) {
        if (responses.isEmpty()) return null;

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
                "other", "other"
        );

        boolean hasAge = false;
        boolean hasGender = false;

        // 2) Duyệt qua các answers của responses để gom demographics
        for (Response r : responses) {
            // gom theo từng question nghi là age/gender
            for (Long qid : ageQuestionIds) {
                List<Answer> answers = answerRepository.findByResponseAndQuestion(r, new Question() {{ setQuestionId(qid); }});
                for (Answer a : answers) {
                    String candidate = extractAnswerText(a);
                    if (candidate == null || candidate.isBlank()) continue;
                    String bucket = bucketAge(candidate);
                    if (bucket != null) {
                        ageBuckets.compute(bucket, (k, v) -> v == null ? 1 : v + 1);
                        hasAge = true;
                    }
                }
            }

            for (Long qid : genderQuestionIds) {
                List<Answer> answers = answerRepository.findByResponseAndQuestion(r, new Question() {{ setQuestionId(qid); }});
                for (Answer a : answers) {
                    String candidate = Optional.ofNullable(extractAnswerText(a)).orElse("").toLowerCase();
                    if (candidate.isBlank()) continue;
                    String normalized = normalizeGender(candidate, genderMap);
                    if (normalized != null) {
                        genderBuckets.compute(normalized, (k, v) -> v == null ? 1 : v + 1);
                        hasGender = true;
                    }
                }
            }
        }

        if (!hasAge && !hasGender) return null;

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
            if (text.contains(n)) return true;
        }
        return false;
    }

    private String extractAnswerText(Answer a) {
        // Ưu tiên answer_text; nếu null, thử lấy option text
        if (a.getAnswerText() != null && !a.getAnswerText().isBlank()) return a.getAnswerText();
        if (a.getOption() != null && a.getOption().getOptionText() != null) return a.getOption().getOptionText();
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
            } catch (Exception ignored) {}
        }
        // Nếu là số đơn lẻ như "18"
        if (s.matches(".*?\\d+.*")) {
            try {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+").matcher(s);
                if (m.find()) {
                    int age = Integer.parseInt(m.group());
                    return mapAgeToBucket(age);
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    private String mapAgeToBucket(int age) {
        if (age < 18) return "<18";
        if (age <= 25) return "18-25";
        if (age <= 35) return "26-35";
        if (age <= 45) return "36-45";
        if (age <= 60) return "46-60";
        return ">60";
    }

    private String normalizeGender(String candidate, Map<String, String> genderMap) {
        String c = candidate.toLowerCase();
        for (Map.Entry<String, String> e : genderMap.entrySet()) {
            if (c.contains(e.getKey())) return e.getValue();
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
    private List<SurveyTimelineResponseDTO.DailyDataDTO> calculateDailyData(List<Response> responses, List<Question> requiredQuestions) {
        Map<String, List<Response>> responsesByDate = responses.stream()
                .collect(Collectors.groupingBy(response -> 
                        response.getSubmittedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))));
        
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
    private List<SurveyTimelineResponseDTO.HourlyDataDTO> calculateHourlyData(List<Response> responses, List<Question> requiredQuestions) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfDay = now.minusDays(1);
        
        // Lọc responses trong 24 giờ gần nhất
        List<Response> recentResponses = responses.stream()
                .filter(response -> response.getSubmittedAt().isAfter(startOfDay))
                .collect(Collectors.toList());
        
        Map<String, List<Response>> responsesByHour = recentResponses.stream()
                .collect(Collectors.groupingBy(response -> 
                        response.getSubmittedAt().format(DateTimeFormatter.ofPattern("HH:mm"))));
        
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
}
