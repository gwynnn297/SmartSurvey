// Test file để kiểm tra tính năng số lượng câu hỏi
export const testQuestionCountGeneration = () => {
    console.log('🧪 Testing Question Count Generation...');

    // Mock function từ CreateAI.jsx
    const generateMockSurvey = (count) => {
        const questionTypes = ['single_choice', 'multiple_choice', 'text', 'rating'];
        const sampleTexts = [
            'Bạn đánh giá chất lượng dịch vụ thế nào?',
            'Bạn có hài lòng với sản phẩm không?',
            'Bạn sẽ giới thiệu cho bạn bè không?',
            'Điểm mạnh nhất của sản phẩm là gì?',
            'Bạn gặp khó khăn gì khi sử dụng?',
            'Tần suất bạn sử dụng sản phẩm?',
            'Bạn sử dụng kênh nào để tìm hiểu?',
            'Bạn có tham gia chương trình khách hàng thân thiết không?',
            'Đánh giá tổng thể về trải nghiệm?',
            'Bạn có kế hoạch tiếp tục sử dụng không?'
        ];

        const questions = Array.from({ length: count }, (_, i) => {
            const type = questionTypes[i % questionTypes.length];

            const question = {
                id: i + 1,
                text: i < sampleTexts.length ? sampleTexts[i] : `Câu hỏi số ${i + 1} do AI sinh ra`,
                type: type,
                required: Math.random() > 0.3,
                options: []
            };

            if (type === 'single_choice' || type === 'multiple_choice') {
                const optionTexts = [
                    ['Rất tốt', 'Tốt', 'Bình thường', 'Kém'],
                    ['Có', 'Không', 'Không chắc'],
                    ['Hàng ngày', 'Vài lần/tuần', 'Hàng tuần', 'Hàng tháng'],
                    ['Rất hài lòng', 'Hài lòng', 'Bình thường', 'Không hài lòng'],
                    ['Chắc chắn có', 'Có thể có', 'Không chắc', 'Có thể không']
                ];

                const selectedOptions = optionTexts[i % optionTexts.length];
                const optionCount = type === 'single_choice' ?
                    (Math.random() > 0.5 ? 2 : 4) :
                    (Math.random() > 0.3 ? 3 : 5);

                question.options = selectedOptions.slice(0, optionCount).map((text, idx) => ({
                    id: idx + 1,
                    text: text
                }));
            }

            return question;
        });

        return {
            id: Date.now(),
            title: "Test Survey",
            description: "Test survey description",
            aiGenerated: true,
            questions
        };
    };

    // Test các số lượng khác nhau
    const testCounts = [1, 5, 10, 15, 20, 25, 30];

    testCounts.forEach(count => {
        console.log(`\n📊 Testing with ${count} questions:`);
        const result = generateMockSurvey(count);

        console.log(`✅ Generated ${result.questions.length} questions`);

        // Kiểm tra types
        const types = result.questions.map(q => q.type);
        const uniqueTypes = [...new Set(types)];
        console.log(`📝 Question types: ${uniqueTypes.join(', ')}`);

        // Kiểm tra options
        const questionsWithOptions = result.questions.filter(q => q.options.length > 0);
        console.log(`🔘 Questions with options: ${questionsWithOptions.length}`);

        // Kiểm tra required
        const requiredQuestions = result.questions.filter(q => q.required);
        console.log(`⭐ Required questions: ${requiredQuestions.length}/${count}`);
    });

    console.log('\n🎉 Question count generation test completed!');
};

// Test validation
export const testQuestionCountValidation = () => {
    console.log('🧪 Testing Question Count Validation...');

    const testCases = [
        { input: '', expected: false, description: 'Empty input' },
        { input: '0', expected: false, description: 'Zero' },
        { input: '1', expected: true, description: 'Minimum (1)' },
        { input: '15', expected: true, description: 'Default (15)' },
        { input: '30', expected: true, description: 'Maximum (30)' },
        { input: '31', expected: false, description: 'Over maximum (31)' },
        { input: '-1', expected: false, description: 'Negative' },
        { input: 'abc', expected: false, description: 'Non-numeric' }
    ];

    testCases.forEach(testCase => {
        const questionCount = Number(testCase.input);
        const isValid = questionCount && questionCount >= 1 && questionCount <= 30;

        const status = isValid === testCase.expected ? '✅' : '❌';
        console.log(`${status} ${testCase.description}: "${testCase.input}" -> ${isValid ? 'valid' : 'invalid'}`);
    });

    console.log('🎉 Validation test completed!');
};

// Run all tests
export const runAllTests = () => {
    console.log('🚀 Running all Question Count tests...\n');
    testQuestionCountGeneration();
    console.log('\n');
    testQuestionCountValidation();
};

// Make available in browser console
if (typeof window !== 'undefined') {
    window.testQuestionCount = runAllTests;
}
