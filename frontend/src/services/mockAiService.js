// Mock AI Service - Tạo response giả lập cho AI Survey
export const mockAiService = {
    // Tạo mock response với 15 câu hỏi
    generateSurveyFromPrompt: async (promptData) => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        const mockResponse = {
            id: 101,
            title: promptData.title || "Khảo sát mức độ hài lòng khách hàng",
            description: `Được AI gợi ý từ prompt: "${promptData.aiPrompt || ''}"`,
            aiGenerated: true,
            questions: [
                {
                    id: 1,
                    text: "Bạn đã từng sử dụng sản phẩm của chúng tôi chưa?",
                    type: "single_choice",
                    required: true,
                    options: [
                        { id: 1, text: "Rồi" },
                        { id: 2, text: "Chưa" }
                    ]
                },
                {
                    id: 2,
                    text: "Bạn đánh giá chất lượng dịch vụ thế nào?",
                    type: "single_choice",
                    required: true,
                    options: [
                        { id: 1, text: "Rất tốt" },
                        { id: 2, text: "Tốt" },
                        { id: 3, text: "Bình thường" },
                        { id: 4, text: "Kém" }
                    ]
                },
                {
                    id: 3,
                    text: "Bạn thường sử dụng sản phẩm/dịch vụ của chúng tôi vào thời điểm nào?",
                    type: "multiple_choice",
                    required: false,
                    options: [
                        { id: 1, text: "Sáng sớm" },
                        { id: 2, text: "Giữa ngày" },
                        { id: 3, text: "Chiều tối" },
                        { id: 4, text: "Cuối tuần" },
                        { id: 5, text: "Không cố định" }
                    ]
                },
                {
                    id: 4,
                    text: "Điểm mạnh nhất của sản phẩm/dịch vụ là gì?",
                    type: "single_choice",
                    required: true,
                    options: [
                        { id: 1, text: "Chất lượng cao" },
                        { id: 2, text: "Giá cả hợp lý" },
                        { id: 3, text: "Dịch vụ khách hàng tốt" },
                        { id: 4, text: "Tiện lợi, dễ sử dụng" }
                    ]
                },
                {
                    id: 5,
                    text: "Bạn có gặp khó khăn gì khi sử dụng sản phẩm/dịch vụ không?",
                    type: "text",
                    required: false,
                    options: []
                },
                {
                    id: 6,
                    text: "Bạn sẽ giới thiệu sản phẩm/dịch vụ cho bạn bè không?",
                    type: "rating",
                    required: true,
                    options: []
                },
                {
                    id: 7,
                    text: "Tần suất bạn sử dụng sản phẩm/dịch vụ?",
                    type: "single_choice",
                    required: true,
                    options: [
                        { id: 1, text: "Hàng ngày" },
                        { id: 2, text: "Vài lần/tuần" },
                        { id: 3, text: "Hàng tuần" },
                        { id: 4, text: "Hàng tháng" },
                        { id: 5, text: "Hiếm khi" }
                    ]
                },
                {
                    id: 8,
                    text: "Điều gì khiến bạn chọn sản phẩm/dịch vụ của chúng tôi?",
                    type: "multiple_choice",
                    required: false,
                    options: [
                        { id: 1, text: "Thương hiệu uy tín" },
                        { id: 2, text: "Giá cả cạnh tranh" },
                        { id: 3, text: "Khuyến mãi hấp dẫn" },
                        { id: 4, text: "Lời giới thiệu từ người khác" },
                        { id: 5, text: "Quảng cáo" }
                    ]
                },
                {
                    id: 9,
                    text: "Bạn có hài lòng với thời gian phản hồi của dịch vụ khách hàng không?",
                    type: "single_choice",
                    required: true,
                    options: [
                        { id: 1, text: "Rất hài lòng" },
                        { id: 2, text: "Hài lòng" },
                        { id: 3, text: "Bình thường" },
                        { id: 4, text: "Không hài lòng" }
                    ]
                },
                {
                    id: 10,
                    text: "Bạn muốn chúng tôi cải thiện điều gì?",
                    type: "text",
                    required: false,
                    options: []
                },
                {
                    id: 11,
                    text: "Bạn sử dụng kênh nào để tìm hiểu về sản phẩm/dịch vụ?",
                    type: "multiple_choice",
                    required: false,
                    options: [
                        { id: 1, text: "Website chính thức" },
                        { id: 2, text: "Mạng xã hội" },
                        { id: 3, text: "Quảng cáo trực tuyến" },
                        { id: 4, text: "Bạn bè giới thiệu" },
                        { id: 5, text: "Cửa hàng vật lý" }
                    ]
                },
                {
                    id: 12,
                    text: "Bạn có tham gia chương trình khách hàng thân thiết không?",
                    type: "single_choice",
                    required: false,
                    options: [
                        { id: 1, text: "Có" },
                        { id: 2, text: "Không" },
                        { id: 3, text: "Không biết" }
                    ]
                },
                {
                    id: 13,
                    text: "Đánh giá tổng thể về trải nghiệm sử dụng sản phẩm/dịch vụ",
                    type: "rating",
                    required: true,
                    options: []
                },
                {
                    id: 14,
                    text: "Bạn có kế hoạch tiếp tục sử dụng sản phẩm/dịch vụ trong tương lai không?",
                    type: "single_choice",
                    required: true,
                    options: [
                        { id: 1, text: "Chắc chắn có" },
                        { id: 2, text: "Có thể có" },
                        { id: 3, text: "Không chắc" },
                        { id: 4, text: "Có thể không" },
                        { id: 5, text: "Chắc chắn không" }
                    ]
                },
                {
                    id: 15,
                    text: "Bạn có góp ý gì khác cho chúng tôi không?",
                    type: "text",
                    required: false,
                    options: []
                }
            ]
        };

        return mockResponse;
    },

    // Simulate API error
    generateSurveyWithError: async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        throw new Error("Không thể tạo gợi ý. Vui lòng thử lại.");
    }
};

export default mockAiService;
