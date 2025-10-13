"""
Ứng dụng FastAPI cho Dịch vụ Tạo Khảo sát
Cung cấp tạo khảo sát thông minh bằng AI sử dụng Gemini API
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from typing import Dict, Any

from .models.survey_schemas import (
    SurveyGenerationRequest, 
    SurveyGenerationResponse,
    SurveyGenerationError,
    CATEGORY_MAPPING
)
from .core.gemini_client import create_gemini_client, GeminiClient

# Cấu hình logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Tạo ứng dụng FastAPI
app = FastAPI(
    title="SmartSurvey - Dịch vụ Tạo Khảo sát",
    description="API dịch vụ tạo khảo sát thông minh sử dụng AI",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8080"],  # URL Frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Gemini client
_gemini_client: GeminiClient = None

def get_gemini_client() -> GeminiClient:
    """Dependency để lấy Gemini client"""
    global _gemini_client
    if _gemini_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="Chưa cấu hình Gemini API key"
            )
        _gemini_client = create_gemini_client(api_key)
    return _gemini_client

@app.on_event("startup")
async def startup_event():
    """Khởi tạo các dịch vụ khi startup"""
    logger.info("Dịch vụ Tạo Khảo sát đang khởi động...")
    
    # Xác minh Gemini API key có sẵn
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("Chưa thiết lập biến môi trường GEMINI_API_KEY")
    else:
        logger.info("Đã cấu hình thành công Gemini API key")

@app.get("/health")
async def health_check():
    """Endpoint kiểm tra sức khỏe dịch vụ"""
    return {
        "status": "healthy",
        "service": "survey-generator",
        "version": "1.0.0"
    }

@app.post("/generate", response_model=SurveyGenerationResponse)
async def generate_survey(
    request: SurveyGenerationRequest,
    gemini_client: GeminiClient = Depends(get_gemini_client)
):
    """
    Tạo khảo sát sử dụng Gemini API
    
    Args:
        request: Yêu cầu tạo khảo sát chứa prompt và metadata
        
    Returns:
        SurveyGenerationResponse với dữ liệu khảo sát đã tạo
    """
    try:
        logger.info(f"Đang tạo khảo sát cho prompt: {request.ai_prompt[:100]}...")
        
        # Xây dựng context từ request
        # Xử lý category: ưu tiên category_id, fallback sang category_name
        category_text = "General"
        if request.category_id and request.category_id in CATEGORY_MAPPING:
            category_text = CATEGORY_MAPPING[request.category_id]
        elif request.category_name:
            category_text = request.category_name
        
        context = {
            "category": category_text,
            "target_audience": request.target_audience,
            "title_hint": request.title,
            "description_hint": request.description,
            "number_of_questions": request.number_of_questions
        }
        
        # Tạo khảo sát sử dụng Gemini
        generated_survey = gemini_client.generate_survey(
            prompt=request.ai_prompt,
            context=context
        )
        
        if generated_survey is None:
            logger.error("Không thể tạo khảo sát từ Gemini API")
            return SurveyGenerationResponse(
                success=False,
                message="Không thể tạo khảo sát. Vui lòng thử lại với prompt khác.",
                error_details={
                    "error_type": "generation_failed",
                    "suggestion": "Hãy thử cung cấp prompt chi tiết hơn hoặc cụ thể hơn"
                }
            )
        
        # Kiểm tra số lượng câu hỏi có đúng với yêu cầu không
        actual_questions = len(generated_survey.questions)
        expected_questions = request.number_of_questions
        
        if actual_questions != expected_questions:
            logger.warning(f"AI tạo {actual_questions} câu hỏi nhưng yêu cầu {expected_questions} câu hỏi")
            return SurveyGenerationResponse(
                success=False,
                message=f"AI tạo {actual_questions} câu hỏi nhưng bạn yêu cầu {expected_questions} câu hỏi. Vui lòng thử lại.",
                error_details={
                    "error_type": "question_count_mismatch",
                    "actual_count": actual_questions,
                    "expected_count": expected_questions,
                    "suggestion": "Thử lại hoặc điều chỉnh prompt để rõ ràng hơn"
                }
            )
        
        logger.info(f"Tạo khảo sát thành công với {actual_questions} câu hỏi đúng như yêu cầu")
        
        return SurveyGenerationResponse(
            success=True,
            message="Tạo khảo sát thành công",
            generated_survey=generated_survey
        )
        
    except Exception as e:
        logger.error(f"Lỗi trong generate_survey: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Lỗi hệ thống khi tạo khảo sát",
                "error_code": "internal_error",
                "error_details": {"exception": str(e)}
            }
        )

@app.get("/categories")
async def get_categories():
    """Lấy danh sách các danh mục khảo sát có sẵn"""
    return {
        "categories": [
            {"id": k, "name": v} for k, v in CATEGORY_MAPPING.items()
        ]
    }

@app.get("/validate-prompt")
async def validate_prompt(prompt: str):
    """Kiểm tra xem prompt có phù hợp để tạo khảo sát không"""
    try:
        if len(prompt.strip()) < 10:
            return {
                "valid": False,
                "message": "Prompt quá ngắn. Vui lòng cung cấp mô tả chi tiết hơn."
            }
        
        if len(prompt.strip()) > 1000:
            return {
                "valid": False,
                "message": "Prompt quá dài. Vui lòng rút gọn lại."
            }
        
        # Kiểm tra các từ khóa liên quan đến khảo sát
        survey_keywords = [
            "khảo sát", "survey", "câu hỏi", "phản hồi", "đánh giá", 
            "ý kiến", "thống kê", "phỏng vấn", "nghiên cứu"
        ]
        
        prompt_lower = prompt.lower()
        has_survey_context = any(keyword in prompt_lower for keyword in survey_keywords)
        
        if not has_survey_context:
            return {
                "valid": True,
                "message": "Prompt hợp lệ nhưng nên bổ sung thêm ngữ cảnh khảo sát.",
                "suggestions": [
                    "Thêm từ khóa như 'khảo sát', 'đánh giá', 'ý kiến'",
                    "Mô tả rõ mục đích thu thập thông tin",
                    "Chỉ định đối tượng khảo sát"
                ]
            }
        
        return {
            "valid": True,
            "message": "Prompt phù hợp để tạo khảo sát"
        }
        
    except Exception as e:
        logger.error(f"Lỗi khi kiểm tra prompt: {str(e)}")
        return {
            "valid": False,
            "message": "Lỗi khi kiểm tra prompt"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True
    )