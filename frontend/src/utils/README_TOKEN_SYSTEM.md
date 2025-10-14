# Hệ thống Token Unique cho Survey Sharing

## Tổng quan

Hệ thống này đảm bảo mỗi lần sinh link chia sẻ cho cùng một khảo sát sẽ có token khác nhau, cho phép phân biệt từng lượt khảo sát riêng biệt.

## Cách hoạt động

### 1. Token Generation
- **File**: `tokenGenerator.js`
- **Function**: `generateUniqueToken()`
- **Format**: `{randomPart}_{timestamp}_{entropy}`
- **Ví dụ**: `a7f3k9x2_1m8n5p4_l9q2w8`

### 2. ShareSurveyPage
- **Trước**: Token được lưu cố định trong localStorage theo `surveyId`
- **Sau**: Mỗi lần load trang sẽ tạo token mới
- **Button mới**: "🔄 Tạo link mới" để tạo token khác ngay lập tức

### 3. PublicResponsePage
- **Validation**: Kiểm tra format token trước khi lưu vào localStorage
- **Logging**: Ghi log khi nhận token hợp lệ/không hợp lệ

### 4. ResponseService
- **Fallback**: Sử dụng `generateUniqueToken()` thay vì tạo token cũ
- **Backend**: Gửi token lên backend để lưu trong bảng `responses`

## Backend Support

Backend đã có đầy đủ hỗ trợ:
- ✅ Bảng `responses` với trường `request_token` (UNIQUE)
- ✅ Entity `Response` với field `requestToken`
- ✅ Repository methods: `findByRequestToken()`, `existsByRequestToken()`
- ✅ Service xử lý token trong `submitResponse()`
- ✅ Controller endpoint `/responses` nhận `requestToken`

## Lợi ích

1. **Phân biệt lượt khảo sát**: Mỗi link đại diện cho một lượt khảo sát riêng biệt
2. **Tracking chính xác**: Có thể theo dõi từng lượt chia sẻ cụ thể
3. **Bảo mật**: Token unique khó đoán và không trùng lặp
4. **Scalable**: Hệ thống có thể mở rộng để thêm các tính năng phân tích chi tiết

## Sử dụng

### Tạo token mới
```javascript
import { generateUniqueToken } from '../utils/tokenGenerator';

const token = generateUniqueToken();
// Output: "a7f3k9x2_1m8n5p4_l9q2w8"
```

### Validate token
```javascript
import { isValidTokenFormat } from '../utils/tokenGenerator';

const isValid = isValidTokenFormat(token);
// Output: true/false
```

### Tạo link chia sẻ
```javascript
const surveyId = 123;
const token = generateUniqueToken();
const shareLink = `${window.location.origin}/response/${surveyId}?k=${token}`;
```

## Migration Notes

- **Không breaking changes**: Hệ thống cũ vẫn hoạt động
- **Backward compatible**: Token cũ vẫn được chấp nhận
- **Gradual rollout**: Có thể triển khai từ từ mà không ảnh hưởng user hiện tại
    