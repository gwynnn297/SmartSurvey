// Test file để kiểm tra mock AI service
import { mockAiService } from './mockAiService';

// Test function
export const testMockAiService = async () => {
    console.log('🧪 Testing Mock AI Service...');

    const testPayload = {
        title: "Khảo sát mức độ hài lòng khách hàng",
        description: "Khảo sát để đánh giá mức độ hài lòng của khách hàng",
        categoryId: 1,
        aiPrompt: "Tạo khảo sát để đánh giá mức độ hài lòng khách hàng với các sản phẩm và dịch vụ của công ty"
    };

    try {
        const result = await mockAiService.generateSurveyFromPrompt(testPayload);
        console.log('✅ Mock AI Service Test Result:', result);

        // Validate structure
        if (result.id && result.title && result.aiGenerated && result.questions) {
            console.log('✅ Structure validation passed');
            console.log(`📊 Generated ${result.questions.length} questions`);

            // Check question types
            const questionTypes = result.questions.map(q => q.type);
            const uniqueTypes = [...new Set(questionTypes)];
            console.log('📝 Question types:', uniqueTypes);

            return true;
        } else {
            console.log('❌ Structure validation failed');
            return false;
        }
    } catch (error) {
        console.error('❌ Mock AI Service Test Error:', error);
        return false;
    }
};

// Test error handling
export const testMockAiError = async () => {
    console.log('🧪 Testing Mock AI Error Handling...');

    try {
        await mockAiService.generateSurveyWithError();
        console.log('❌ Error test failed - should have thrown error');
        return false;
    } catch (error) {
        console.log('✅ Error handling test passed:', error.message);
        return true;
    }
};

// Run tests if called directly
if (typeof window !== 'undefined') {
    window.testMockAi = async () => {
        console.log('🚀 Running Mock AI Service Tests...');
        const test1 = await testMockAiService();
        const test2 = await testMockAiError();

        if (test1 && test2) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('💥 Some tests failed!');
        }
    };
}
