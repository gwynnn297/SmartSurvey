"""
Pydantic schemas cho tạo khảo sát
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

class SurveyGenerationRequest(BaseModel):
    """Mô hình request cho tạo khảo sát"""
    title: str = Field(..., max_length=100, description="Tiêu đề khảo sát")
    description: str = Field(..., max_length=500, description="Mô tả khảo sát")
    category_id: int = Field(..., description="ID danh mục từ database chính")
    ai_prompt: str = Field(..., max_length=1000, description="AI prompt để tạo khảo sát")
    target_audience: Optional[str] = Field(None, max_length=200, description="Đối tượng mục tiêu")
    number_of_questions: int = Field(..., ge=3, le=20, description="Số lượng câu hỏi cần tạo")
    
    @validator('ai_prompt')
    def validate_prompt(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError("AI prompt phải có ít nhất 10 ký tự")
        return v.strip()

class OptionSchema(BaseModel):
    """Schema cho các lựa chọn câu hỏi"""
    option_text: str = Field(..., max_length=200, description="Nội dung lựa chọn")
    display_order: int = Field(..., ge=1, description="Thứ tự hiển thị")

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
        
        # Câu hỏi nhiều lựa chọn phải có options
        if question_type == QuestionType.multiple_choice:
            if not v or len(v) < 2:
                raise ValueError(f"Câu hỏi {question_type} phải có ít nhất 2 lựa chọn")
            if len(v) > 10:
                raise ValueError(f"Câu hỏi {question_type} không thể có quá 10 lựa chọn")
        
        # Câu hỏi mở, đánh giá và boolean không nên có options
        elif question_type in [QuestionType.open_ended, QuestionType.rating, QuestionType.boolean_]:
            if v and len(v) > 0:
                raise ValueError(f"Câu hỏi {question_type} không nên có lựa chọn")
        
        return v

class GeneratedSurveyResponse(BaseModel):
    """Mô hình response cho khảo sát được tạo từ Gemini API"""
    title: str = Field(..., max_length=100)
    description: str = Field(..., max_length=500)
    questions: List[QuestionSchema] = Field(..., min_items=1, max_items=20)
    
    @validator('questions')
    def validate_questions(cls, v):
        if len(v) < 3:
            raise ValueError("Khảo sát phải có ít nhất 3 câu hỏi")
        
        # Kiểm tra thứ tự hiển thị là duy nhất và tuần tự
        orders = [q.display_order for q in v]
        if len(set(orders)) != len(orders):
            raise ValueError("Thứ tự hiển thị câu hỏi phải là duy nhất")
        
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