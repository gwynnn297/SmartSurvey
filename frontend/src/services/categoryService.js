import { apiClient } from './authService';

export const categoryService = {
    // Lấy tất cả categories
    getAllCategories: async () => {
        try {
            const response = await apiClient.get('/categories');
            return response.data;
        } catch (error) {
            console.error('Error fetching categories:', error);
            throw error;
        }
    },

    // Tìm category theo tên (để gợi ý)
    searchCategories: async (name) => {
        try {
            const response = await apiClient.get(`/categories/search?name=${encodeURIComponent(name)}`);
            return response.data;
        } catch (error) {
            console.error('Error searching categories:', error);
            throw error;
        }
    },

    // Tạo category mới nếu chưa tồn tại
    createCategoryIfNotExists: async (categoryName) => {
        try {
            // Kiểm tra xem category đã tồn tại chưa
            const searchResponse = await apiClient.get(`/categories/search?name=${encodeURIComponent(categoryName)}`);

            if (searchResponse.data && searchResponse.data.length > 0) {
                // Category đã tồn tại, trả về category đầu tiên
                return searchResponse.data[0];
            } else {
                // Category chưa tồn tại, tạo mới
                const createResponse = await apiClient.post('/categories', {
                    categoryName: categoryName
                });
                return createResponse.data;
            }
        } catch (error) {
            console.error('Error creating category:', error);
            throw error;
        }
    }
};