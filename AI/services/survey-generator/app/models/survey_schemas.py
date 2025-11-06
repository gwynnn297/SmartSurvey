"""
Pydantic schemas cho tạo khảo sát  (survey_schemas)
Định nghĩa các mô hình dữ liệu cho API requests và responses
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum



class QuestionType(str, Enum):
    multiple_choice = "multiple_choice"  # Trắc nghiệm nhiều lựa chọn
    open_ended = "open_ended"            # Câu hỏi mở  
    rating = "rating"                    # Đánh giá
    boolean_ = "boolean_"                # Đúng/Sai
    date_time = "date_time"              # Chọn ngày/giờ
    file_upload = "file_upload"          # Tải tệp
    single_choice   = "single_choice"    # Trắc Nghiệm Chọn 1
    ranking         = "ranking"          # Xêp hạng

# Giúp main.py/FE lấy danh sách loại hợp lệ từ một nơi duy nhất
SUPPORTED_TYPES = [
    QuestionType.multiple_choice.value,
    QuestionType.single_choice.value,
    QuestionType.ranking.value,
    QuestionType.rating.value,
    QuestionType.open_ended.value,
    QuestionType.boolean_.value,
    QuestionType.date_time.value,
    QuestionType.file_upload.value,
]


class SurveyGenerationRequest(BaseModel):
    """Mô hình request cho tạo khảo sát"""
    title: str = Field(..., max_length=100, description="Tiêu đề khảo sát")
    description: str = Field(..., max_length=500, description="Mô tả khảo sát")
    category_id: Optional[int] = Field(default=None, description="ID danh mục từ database chính")
    category_name: Optional[str] = Field(default=None, max_length=100, description="Tên danh mục (text)")
    ai_prompt: str = Field(..., max_length=1000, description="AI prompt để tạo khảo sát")
    target_audience: Optional[str] = Field(None, max_length=200, description="Đối tượng mục tiêu")
    number_of_questions: int = Field(..., ge=1, le=100, description="Số câu cần tạo")
    
    @validator('ai_prompt')
    def validate_prompt(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError("AI prompt phải có ít nhất 10 ký tự")
        return v.strip()
        
    @validator('category_name')
    def validate_category(cls, v, values):
        # Có thể có hoặc không có category, nếu không có sẽ dùng default
        return v

class OptionSchema(BaseModel):
    option_text: str = Field(..., max_length=200, description="Nội dung lựa chọn")
    display_order: int = Field(..., ge=1, description="Thứ tự hiển thị")

    @validator("option_text")
    def _strip_option(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Nội dung lựa chọn không được rỗng")
        return v


class QuestionSchema(BaseModel):
    """Schema cho câu hỏi khảo sát"""
    question_text: str = Field(..., max_length=500, description="Nội dung câu hỏi")
    question_type: QuestionType = Field(..., description="Loại câu hỏi")
    is_required: bool = Field(default=True, description="Có bắt buộc trả lời không")
    display_order: int = Field(..., ge=1, description="Thứ tự hiển thị")
    options: Optional[List[OptionSchema]] = Field(default=None, description="Các lựa chọn câu hỏi")
    
    @validator('options')
    def validate_options(cls, v, values):
        question_type = values.get('question_type')

        # Chuẩn hoá: nếu có options -> lọc option_text rỗng
        if v:
            v = [o for o in v if (o and getattr(o, "option_text", "").strip())]

        # Bắt buộc options với MC/SC/Ranking
        if question_type in (QuestionType.multiple_choice, QuestionType.single_choice):
            if not v or len(v) < 2:
                raise ValueError(f"Câu hỏi {question_type} phải có ít nhất 2 lựa chọn")
            if len(v) > 10:
                raise ValueError(f"Câu hỏi {question_type} không thể có quá 10 lựa chọn")

        elif question_type == QuestionType.ranking:
            if not v or len(v) < 3:
                raise ValueError("Câu hỏi ranking phải có ≥ 3 lựa chọn để sắp hạng")
            if len(v) > 10:
                raise ValueError("Câu hỏi ranking không thể có quá 10 lựa chọn")

        # Các loại còn lại không được có options
        elif question_type in [
            QuestionType.open_ended,
            QuestionType.rating,
            QuestionType.boolean_,
            QuestionType.date_time,
            QuestionType.file_upload,
        ]:
            if v and len(v) > 0:
                raise ValueError(f"Câu hỏi {question_type} không nên có lựa chọn")

        return v

class GeneratedSurveyResponse(BaseModel):
    """Mô hình response cho khảo sát được tạo từ Gemini API"""
    title: str = Field(..., max_length=100)
    description: str = Field(..., max_length=500)
    questions: List[QuestionSchema] = Field(..., min_items=1, max_items=1000)

    @validator('questions')
    def validate_questions(cls, v):
        if len(v) < 3:
            raise ValueError("Khảo sát phải có ít nhất 3 câu hỏi")
        
        # Kiểm tra thứ tự hiển thị là duy nhất và tuần tự
        orders = [q.display_order for q in v]
        if len(set(orders)) != len(orders):
            raise ValueError("Thứ tự hiển thị câu hỏi phải là duy nhất")
        
        if sorted(orders) != list(range(1, len(v) + 1)):
            raise ValueError("Thứ tự hiển thị câu hỏi phải liên tục từ 1..N")

        return v

class SurveyGenerationResponse(BaseModel):
    """API response cho tạo khảo sát"""
    success: bool = Field(..., description="Có tạo thành công không")
    survey_id: Optional[int] = Field(None, description="ID khảo sát được tạo")
    message: str = Field(..., description="Thông báo phản hồi")
    generated_survey: Optional[GeneratedSurveyResponse] = Field(None, description="Dữ liệu khảo sát được tạo")
    error_details: Optional[Dict[str, Any]] = Field(None, description="Chi tiết lỗi nếu thất bại")

class SurveyGenerationError(BaseModel):
    """Mô hình error response"""
    success: bool = Field(default=False)
    message: str = Field(..., description="Thông báo lỗi")
    error_code: str = Field(..., description="Mã lỗi")
    error_details: Optional[Dict[str, Any]] = Field(None, description="Chi tiết lỗi bổ sung")

# Ánh xạ danh mục (có thể mở rộng dựa trên database chính)
CATEGORY_MAPPING = {
    1: "Khảo sát khách hàng",
    2: "Khảo sát nhân viên", 
    3: "Khảo sát học viên",
    4: "Khảo sát sản phẩm",
    5: "Khảo sát dịch vụ"
}