# Ranking Question Update - Option ID Support

## Thay Đổi Chính

### 1. **Lý Do Thay Đổi**
- **Vấn đề cũ**: Ranking questions lưu text values trong `answer_text`, không có validation với options thực tế
- **Vấn đề**: User có thể nhập bất kỳ text nào, không đảm bảo data integrity
- **Giải pháp**: Lưu `option_id` thay vì text để validate và maintain referential integrity

### 2. **Cập Nhật Data Structure**

#### **AnswerSubmitDTO** - New Fields:
```java
// For ranking questions
private List<String> rankingOrder; // Deprecated - for backward compatibility
private List<Long> rankingOptionIds; // New field - option IDs in ranking order
```

#### **AnswerDTO** - Response Fields:
```java
// For ranking questions
private List<String> rankingOrder; // Legacy format - for backward compatibility
private List<Long> rankingOptionIds; // New format - option IDs in ranking order
```

### 3. **Storage Method**

#### **New Format (Recommended)**:
- Tạo **multiple Answer records**, mỗi record cho 1 ranked option
- `option_id`: Link đến Option entity
- `answer_text`: Chứa rank number (1, 2, 3, ...)
- **Validation**: Đảm bảo tất cả option IDs thuộc về question

#### **Legacy Format (Backward Compatible)**:
- Single Answer record với JSON string trong `answer_text`
- Giữ nguyên cho compatibility

### 4. **API Changes**

#### **Submit Request (New Recommended Format)**:
```json
{
  "questionId": 4,
  "questionType": "ranking",
  "rankingOptionIds": [3, 1, 2, 4]  // Option IDs theo thứ tự preference
}
```

#### **Submit Request (Legacy Format - Still Supported)**:
```json
{
  "questionId": 4,
  "questionType": "ranking", 
  "rankingOrder": ["Option C", "Option A", "Option B", "Option D"]
}
```

#### **Response Format (New)**:
```json
{
  "answerId": 1,
  "questionId": 4,
  "rankingOptionIds": [3, 1, 2, 4],
  "answerText": null,
  "questionText": "Xếp hạng các brand theo sở thích"
}
```

### 5. **Validation Logic**

#### **New Validation Rules**:
```java
// Validate that all option IDs belong to the question
List<Option> questionOptions = optionRepository.findByQuestionOrderByCreatedAt(question);
List<Long> validOptionIds = questionOptions.stream()
        .map(Option::getOptionId)
        .collect(Collectors.toList());

for (Long optionId : dto.getRankingOptionIds()) {
    if (!validOptionIds.contains(optionId)) {
        throw new IdInvalidException("Option ID " + optionId + " không thuộc câu hỏi ranking này");
    }
}

// Check if all options are ranked (business logic requirement)
if (dto.getRankingOptionIds().size() != validOptionIds.size()) {
    throw new IdInvalidException("Phải xếp hạng tất cả các options cho câu hỏi ranking");
}
```

### 6. **Database Storage**

#### **New Format Example**:
```sql
-- Question có 4 options: id=1,2,3,4
-- User ranks: [3,1,2,4] (option 3 best, option 4 worst)

INSERT INTO answers (response_id, question_id, option_id, answer_text) VALUES
(101, 4, 3, '1'),  -- Option 3 ranked #1 (best)
(101, 4, 1, '2'),  -- Option 1 ranked #2  
(101, 4, 2, '3'),  -- Option 2 ranked #3
(101, 4, 4, '4');  -- Option 4 ranked #4 (worst)
```

#### **Legacy Format Example**:
```sql
INSERT INTO answers (response_id, question_id, option_id, answer_text) VALUES
(101, 4, NULL, '["Option C", "Option A", "Option B", "Option D"]');
```

### 7. **Read Logic**

#### **ProcessRankingAnswer Helper Method**:
```java
private void processRankingAnswer(List<Answer> questionAnswers, AnswerDTO ad) {
    // Check if new format (multiple records with option_id)
    boolean hasRankingRecords = questionAnswers.stream()
            .allMatch(a -> a.getOption() != null && a.getAnswerText() != null);
    
    if (hasRankingRecords && questionAnswers.size() > 1) {
        // New format: extract option IDs in rank order
        List<Long> rankingOptionIds = questionAnswers.stream()
                .sorted((a1, a2) -> {
                    int rank1 = Integer.parseInt(a1.getAnswerText());
                    int rank2 = Integer.parseInt(a2.getAnswerText());
                    return Integer.compare(rank1, rank2);
                })
                .map(a -> a.getOption().getOptionId())
                .toList();
        
        ad.setRankingOptionIds(rankingOptionIds);
    } else {
        // Legacy format: deserialize JSON string
        ad.setRankingOrder(answerDataHelper.deserializeRankingOrder(firstAnswer.getAnswerText()));
    }
}
```

### 8. **Frontend Implementation**

#### **Recommended Approach**:
1. **UI**: Drag-drop interface với options từ server
2. **Submit**: Gửi `rankingOptionIds` array theo thứ tự user sắp xếp
3. **Validation**: Check tất cả options đã được ranked
4. **Display**: Show option text từ option IDs

#### **Example Frontend Code**:
```javascript
// Get options từ question API
const options = [
  {id: 1, text: "Brand A"},
  {id: 2, text: "Brand B"}, 
  {id: 3, text: "Brand C"},
  {id: 4, text: "Brand D"}
];

// User drags to rank: Brand C > Brand A > Brand B > Brand D
const userRanking = [3, 1, 2, 4]; // option IDs in preference order

// Submit
const answer = {
  questionId: 4,
  questionType: "ranking",
  rankingOptionIds: userRanking
};
```

### 9. **Migration Strategy**

#### **Phase 1**: **Backward Compatible** (Current)
- ✅ Support both new and legacy formats
- ✅ New submissions use option IDs
- ✅ Old data still readable via legacy format

#### **Phase 2**: **Migration** (Future)
- Convert existing legacy JSON data to new format
- Migrate `answer_text` JSON to multiple Answer records

#### **Phase 3**: **Cleanup** (Future)
- Remove legacy format support
- Clean up helper methods

### 10. **Benefits**

#### **Data Integrity**:
- ✅ Foreign key constraints với Options table
- ✅ Validation: không thể rank option không tồn tại
- ✅ Consistent data structure

#### **Performance**:
- ✅ Queries hiệu quả hơn với indexes
- ✅ Join operations dễ dàng
- ✅ Analytical queries tốt hơn

#### **Maintainability**:
- ✅ Clear data relationships
- ✅ Easier to add features (e.g., option weights)
- ✅ Better error handling

### 11. **Testing**

#### **Test Cases Cần Kiểm Tra**:
1. ✅ Submit ranking với valid option IDs
2. ✅ Submit ranking với invalid option IDs → Error
3. ✅ Submit ranking thiếu options → Error  
4. ✅ Submit ranking với duplicate option IDs → Error
5. ✅ Response format chính xác cho new format
6. ✅ Backward compatibility với legacy format
7. ✅ Mixed survey với ranking + other question types

---

## **Summary**

✅ **Completed**: Ranking questions giờ đây support option_id validation  
✅ **Backward Compatible**: Legacy format vẫn hoạt động  
✅ **Data Integrity**: Full validation với Option entities  
✅ **API Updated**: Documentation đã được cập nhật  
✅ **Ready for Frontend**: Clear guidelines cho implementation  

**Next Steps cho Frontend Team**:
1. Implement drag-drop ranking UI với option IDs
2. Use `rankingOptionIds` field cho new submissions  
3. Handle `rankingOptionIds` trong response display
4. Test với mixed content surveys