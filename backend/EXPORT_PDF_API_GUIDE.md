# Hướng dẫn Export PDF API

## 📋 URL Endpoint

### Export PDF với biểu đồ
```
GET /api/surveys/{surveyId}/results/export-pdf
```

**Base URL:** `http://localhost:8080` (hoặc domain của bạn)

**Ví dụ đầy đủ:**
```
GET http://localhost:8080/api/surveys/1/results/export-pdf
```

---

## 🔐 Authentication

**Yêu cầu:** Cần JWT token trong header

**Header:**
```
Authorization: Bearer {your_jwt_token}
```

**Quyền:** Chỉ **OWNER** và **ANALYST** mới có quyền export PDF

---

## 📥 Request

### Method
```
GET
```

### Path Parameters
| Parameter | Type | Required | Mô tả |
|-----------|------|----------|-------|
| `surveyId` | Long | ✅ Yes | ID của survey cần export |

### Headers
```
Authorization: Bearer {token}
Content-Type: application/json (không cần thiết cho GET)
```

### Ví dụ Request

**cURL:**
```bash
curl -X GET "http://localhost:8080/api/surveys/1/results/export-pdf" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  --output survey_report.pdf
```

**JavaScript (Axios):**
```javascript
import axios from 'axios';

const exportPDF = async (surveyId) => {
  try {
    const response = await axios.get(
      `http://localhost:8080/api/surveys/${surveyId}/results/export-pdf`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        responseType: 'blob' // Quan trọng: phải set responseType là 'blob'
      }
    );

    // Tạo blob URL và download
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Lấy filename từ Content-Disposition header hoặc tạo tên mặc định
    const contentDisposition = response.headers['content-disposition'];
    let filename = `survey_report_${surveyId}_${Date.now()}.pdf`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    console.log('✅ PDF exported successfully');
  } catch (error) {
    console.error('❌ Export PDF error:', error);
    if (error.response?.data) {
      // Backend trả về JSON error
      const errorData = error.response.data;
      alert(errorData.message || 'Không thể xuất PDF');
    }
  }
};

// Sử dụng
exportPDF(1);
```

**React Service (thêm vào dashboardReportService.js):**
```javascript
/**
 * Xuất báo cáo PDF với biểu đồ cho survey
 * GET /api/surveys/{surveyId}/results/export-pdf
 * @param {number} surveyId - ID khảo sát
 * @returns {Promise<void>} Download PDF file
 */
exportPDF: async (surveyId) => {
    try {
        console.log('📄 Exporting PDF for survey:', surveyId);
        
        const response = await apiClient.get(
            `/api/surveys/${surveyId}/results/export-pdf`,
            {
                responseType: 'blob' // Quan trọng!
            }
        );

        // Tạo blob và download
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Lấy filename từ header hoặc tạo tên mặc định
        const contentDisposition = response.headers['content-disposition'];
        let filename = `survey_report_${surveyId}_${new Date().getTime()}.pdf`;
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
            }
        }
        
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log('✅ PDF exported successfully:', filename);
    } catch (error) {
        console.error('❌ Export PDF error:', error);
        
        // Xử lý lỗi từ backend (JSON response)
        if (error.response?.data) {
            // Nếu response là blob nhưng có lỗi, cần parse
            if (error.response.data instanceof Blob) {
                const text = await error.response.data.text();
                try {
                    const errorJson = JSON.parse(text);
                    throw new Error(errorJson.message || 'Không thể xuất PDF');
                } catch (parseError) {
                    throw new Error('Không thể xuất PDF');
                }
            } else {
                // Response là JSON error
                throw new Error(error.response.data.message || 'Không thể xuất PDF');
            }
        }
        
        throw error;
    }
}
```

---

## 📤 Response

### Success Response (200 OK)

**Content-Type:** `application/pdf`

**Headers:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="survey_report_1_20250128_120000.pdf"; filename*=UTF-8''survey_report_1_20250128_120000.pdf
```

**Body:** PDF file (binary data)

**Filename format:**
```
survey_report_{surveyId}_{timestamp}.pdf
```

Ví dụ: `survey_report_1_20250128_120000.pdf`

---

### Error Responses

#### 403 Forbidden (Không có quyền)
```json
{
  "message": "Bạn không có quyền xem thống kê khảo sát này. Chỉ chủ sở hữu (OWNER) và phân tích viên (ANALYST) mới có quyền xem báo cáo."
}
```

#### 404 Not Found (Survey không tồn tại)
```json
{
  "message": "Không tìm thấy khảo sát"
}
```

#### 500 Internal Server Error
```json
{
  "message": "Lỗi hệ thống khi xuất PDF: {error_message}"
}
```

---

## 📊 Nội dung PDF bao gồm

1. **Thông tin Survey:**
   - Tiêu đề survey
   - ID, Ngày tạo, Trạng thái

2. **Thống kê tổng quan (Bảng):**
   - Tổng số phản hồi
   - Số lượt xem
   - Tỷ lệ hoàn thành
   - Thời gian trung bình
   - Chi tiết completion stats

3. **Biểu đồ câu hỏi lựa chọn:**
   - Multiple Choice (Pie chart)
   - Single Choice (Pie chart)
   - Ranking (Bar chart)

4. **Biểu đồ câu hỏi đánh giá:**
   - Rating (Bar chart với distribution)
   - Average rating

5. **Biểu đồ câu hỏi Yes/No:**
   - Boolean (Pie chart)

6. **Biểu đồ xu hướng phản hồi theo thời gian:**
   - Timeline Daily (Line chart)

7. **Biểu đồ phân tích cảm xúc:**
   - Sentiment Overall (Pie chart)
   - Phần trăm chi tiết

---

## 🔍 Kiểm tra JSON Response (nếu có lỗi)

Nếu bạn muốn kiểm tra JSON error response, cần xử lý đặc biệt vì response type là `blob`:

```javascript
try {
    const response = await apiClient.get(`/api/surveys/${surveyId}/results/export-pdf`, {
        responseType: 'blob'
    });
    
    // Kiểm tra nếu response không phải PDF (có thể là JSON error)
    if (response.data.type !== 'application/pdf') {
        const text = await response.data.text();
        const errorJson = JSON.parse(text);
        console.error('Error:', errorJson);
        alert(errorJson.message);
        return;
    }
    
    // Xử lý PDF như bình thường
    // ...
} catch (error) {
    // Xử lý lỗi
}
```

---

## 📝 Ví dụ sử dụng trong React Component

```javascript
import { dashboardReportService } from '../services/dashboardReportService';

const ExportPDFButton = ({ surveyId }) => {
    const [loading, setLoading] = useState(false);
    
    const handleExportPDF = async () => {
        setLoading(true);
        try {
            await dashboardReportService.exportPDF(surveyId);
            alert('Xuất PDF thành công!');
        } catch (error) {
            alert('Lỗi: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <button 
            onClick={handleExportPDF} 
            disabled={loading}
        >
            {loading ? 'Đang xuất...' : '📄 Xuất PDF'}
        </button>
    );
};
```

---

## 🧪 Test với Postman

1. **Method:** GET
2. **URL:** `http://localhost:8080/api/surveys/1/results/export-pdf`
3. **Headers:**
   - `Authorization: Bearer YOUR_JWT_TOKEN`
4. **Send and Download:**
   - Click "Send"
   - Click "Save Response" → "Save to a file"
   - File sẽ được download với tên `survey_report_1_*.pdf`

---

## ⚠️ Lưu ý

1. **Response Type:** Phải set `responseType: 'blob'` khi gọi API từ frontend
2. **Authentication:** Cần JWT token hợp lệ
3. **Quyền:** Chỉ OWNER và ANALYST mới có quyền
4. **File Size:** PDF có thể lớn nếu có nhiều biểu đồ, cần xử lý timeout phù hợp
5. **Error Handling:** Backend trả về JSON khi có lỗi, nhưng response type là blob nên cần parse đặc biệt

---

## 📌 Tóm tắt URL

| Mục đích | Method | URL | Response |
|----------|--------|-----|----------|
| Export PDF | GET | `/api/surveys/{surveyId}/results/export-pdf` | PDF file (blob) |
| Get Overview (JSON) | GET | `/api/surveys/{surveyId}/results/overview` | JSON |
| Get Charts (JSON) | GET | `/api/surveys/{surveyId}/results/charts` | JSON |
| Get Timeline (JSON) | GET | `/api/surveys/{surveyId}/results/timeline` | JSON |
| Get Sentiment (JSON) | GET | `/api/surveys/{surveyId}/results/sentiment` | JSON |

---

*Tài liệu này mô tả API export PDF với tất cả biểu đồ đã được implement.*


