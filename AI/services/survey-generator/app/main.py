"""
Ứng dụng FastAPI cho Dịch vụ Tạo Khảo sát
Cung cấp tạo khảo sát thông minh bằng AI sử dụng Gemini API
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from datetime import datetime
from pydantic import BaseModel
load_dotenv()

from .models.survey_schemas import (
    SurveyGenerationRequest, 
    SurveyGenerationResponse,
    SurveyGenerationError,
    QuestionSchema,
    GeneratedSurveyResponse,
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

# 1) Prompt templates (5+ industry templates) + DEFAULT
DEFAULT_TEMPLATE = """Bạn là chuyên gia nghiên cứu thị trường.
Hãy tạo {n} câu hỏi khảo sát chất lượng cao cho chủ đề: "{title}".
Loại câu hỏi có thể dùng: {types}.
Yêu cầu:
- Rõ ràng, một ý hỏi một điều
- Không dẫn dắt, không thiên kiến
- Các lựa chọn (với câu multiple-choice/single-choice) cân bằng, không trùng lặp
- Với câu ranking: cung cấp 5-7 mục để xếp hạng, không trùng ý
- Với rating: nêu rõ thang điểm (1-5)
- Với open-ended: tránh câu hỏi quá rộng, có gợi ý phạm vi trả lời

Trả về JSON theo schema đã được mô tả (questions: text, type, options nếu có)."""

INDUSTRY_TEMPLATES: Dict[str, str] = {
    "ecommerce": """Bạn là chuyên gia CX cho sàn thương mại điện tử.
Tạo {n} câu hỏi cho survey "{title}".
Loại: {types}.
Nhấn mạnh: trải nghiệm mua hàng, thanh toán, giao hàng, đổi trả, CSKH, lòng trung thành.
Đảm bảo rõ ràng, không leading, phù hợp ngữ cảnh eCommerce.
Trả về JSON theo schema.""",

    "saas": """Bạn là chuyên gia Product cho SaaS B2B.
Tạo {n} câu hỏi cho survey "{title}".
Loại: {types}.
Nhấn mạnh: onboarding, feature usability, pricing, support, performance, ROI.
Trả về JSON theo schema.""",

    "education": """Bạn là chuyên gia khảo thí trong giáo dục.
Tạo {n} câu hỏi cho survey "{title}".
Loại: {types}.
Nhấn mạnh: chất lượng giảng dạy, tài liệu, LMS, đánh giá, hỗ trợ học tập.
Trả về JSON theo schema.""",

    "healthcare": """Bạn là chuyên gia trải nghiệm bệnh nhân (PX).
Tạo {n} câu hỏi cho survey "{title}".
Loại: {types}.
Nhấn mạnh: đặt lịch, tiếp đón, chẩn đoán, điều trị, chăm sóc, thông tin rõ ràng.
Trả về JSON theo schema.""",

    "finance": """Bạn là chuyên gia trải nghiệm khách hàng cho dịch vụ tài chính.
Tạo {n} câu hỏi cho survey "{title}".
Loại: {types}.
Nhấn mạnh: mở tài khoản, giao dịch, phí, bảo mật, hỗ trợ, app/mobile banking.
Trả về JSON theo schema.""",
}
SUPPORTED_TYPES = ["multiple_choice","single_choice","ranking","rating","open_ended","boolean_"]

# 2) Helpers: chuẩn hoá category, build prompt, validate + score
def normalize_category(cat) -> str:
    from app.models.survey_schemas import CATEGORY_MAPPING
    if cat is None:
        return "general"
    if isinstance(cat, int) and cat in CATEGORY_MAPPING:
        return str(CATEGORY_MAPPING[cat]).strip().lower()
    return str(cat).strip().lower()


def validate_question_text(q: str) -> List[str]:
    """Rule-based validation: phát hiện lỗi phổ biến."""
    issues: List[str] = []
    if not q or len(q.strip()) < 8:
        issues.append("Câu hỏi quá ngắn/không rõ.")
    low = q.lower()
    if "tại sao bạn không" in low or "có phải" in low or "đồng ý rằng" in low:
        issues.append("Câu hỏi có thể dẫn dắt/thiên kiến.")
    if "và tại sao" in low and len(q) > 180:
        issues.append("Câu hỏi quá dài hoặc gộp nhiều ý.")
    return issues

def score_question(q: str) -> int:
    """Chấm điểm chất lượng [0..100] theo quy tắc đơn giản + chiều dài hợp lý."""
    if not q:
        return 0
    score = 60
    ln = len(q.strip())
    if 40 <= ln <= 140:
        score += 20
    elif 20 <= ln < 40 or 140 < ln <= 220:
        score += 10
    penalty_words = ["có phải", "rõ ràng là", "chắc chắn", "ai cũng biết"]
    for w in penalty_words:
        if w in q.lower():
            score -= 10
    return max(0, min(100, score))

def build_prompt(req: SurveyGenerationRequest) -> str:
    category = normalize_category(getattr(req, "category_name", None))
    tmpl = INDUSTRY_TEMPLATES.get(category, DEFAULT_TEMPLATE)
    types_text = ", ".join(SUPPORTED_TYPES)
    extra = []
    if getattr(req, "ai_prompt", None):
        extra.append(req.ai_prompt.strip())
    if getattr(req, "description", None):
        extra.append(req.description.strip())
    context = "\nNgữ cảnh bổ sung từ người dùng:\n" + "\n".join(extra) if extra else ""

    final_prompt = tmpl.format(
        n=req.number_of_questions,
        title=req.title,
        types=types_text
    ) + context
    return final_prompt

def _coerce_option_list(opts: Any) -> List[str]:
    """Chuẩn hoá options về list[str]."""
    if not opts:
        return []
    if isinstance(opts, list):
        return [str(x).strip() for x in opts if str(x).strip()]
    # đôi khi model trả string "A;B;C"
    if isinstance(opts, str):
        parts = [p.strip() for p in opts.split(";")]
        return [p for p in parts if p]
    return []

def _normalize_type(t: str) -> str:
    t = (t or "").strip().lower().replace("-", "_").replace(" ", "_")
    if t in SUPPORTED_TYPES:
        return t
    if t in ["singlechoice", "single", "radio"]:
        return "single_choice"
    if t in ["mcq", "multiple", "multi_choice", "multi"]:
        return "multiple_choice"
    if t in ["boolean", "yes_no"]:
        return "boolean_"
    return t or "open_ended"

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
        "version": "1.0.0",
        "ok" : True
    }

@app.get("/templates")
def list_templates():
    return {
        "default": True,
        "supported_types": SUPPORTED_TYPES,
        "industries": list(INDUSTRY_TEMPLATES.keys())
    }

@app.post("/generate", response_model=SurveyGenerationResponse)
def generate_survey(request: SurveyGenerationRequest):
    try:
        prompt = build_prompt(request)

        client: GeminiClient = get_gemini_client()
        gem_res = client.generate_survey( prompt=prompt, context=request.description or "" )

        if not gem_res or not getattr(gem_res, "questions", None):
            return SurveyGenerationResponse(
                success=False,
                message="AI không trả về câu hỏi nào.",
                error_details={"raw": gem_res.dict() if hasattr(gem_res, "dict") else str(gem_res)}
            )

        normalized_questions: List[Dict[str, Any]] = []
        low_quality: List[Dict[str, Any]] = []

        for q in gem_res.questions:
            q_type = _normalize_type(getattr(q, "type", "open_ended"))
            q_text = getattr(q, "question_text", "").strip()

            options = getattr(q, "options", None)
            if q_type in ("multiple_choice", "single_choice", "ranking"):
                opts = _coerce_option_list(options)
                if q_type == "ranking" and len(opts) < 5:
                    opts = opts + [f"Mục {i}" for i in range(1, max(6 - len(opts), 0) + 1)]
                options = opts
            else:
                options = None

            issues = validate_question_text(q_text)
            q_score = score_question(q_text)

            record = {
                "question_text": q_text,
                "type": q_type,
                "options": options,
                "score": q_score,
                "issues": issues
            }
            normalized_questions.append(record)

            if issues or q_score < 70:
                low_quality.append({"text": q_text, "score": q_score, "issues": issues})

        if low_quality:
            return SurveyGenerationResponse(
                success=False,
                message="Một số câu hỏi chưa đạt chất lượng tối thiểu.",
                error_details={"low_quality": low_quality, "generated": normalized_questions}
            )
        gen = GeneratedSurveyResponse(
            title=request.title,
            description=request.description,
            questions=[
                QuestionSchema(
                    question_text=it["question_text"],
                    question_type=it["type"],
                    is_required=True,
                    display_order=i+1,
                    options=[{"option_text": o, "display_order": j+1} for j, o in enumerate(it["options"] or [])]
                )
                for i, it in enumerate(normalized_questions)
            ]
        )
        return SurveyGenerationResponse(
            success=True,
            survey_id=None,
            message="Tạo câu hỏi thành công",
            generated_survey=gen
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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

# Cải thiện thời gian resfresh 1 question 
class RefreshQuestionRequest(BaseModel):
    title: str
    category: str | None = None
    question_type: str  # "single_choice" | "multiple_choice" | "ranking" | "rating" | "open_ended" | "boolean"
    ai_prompt: str | None = None          # gợi ý thêm của user
    previous_question: str | None = None  # câu cũ để “rephrase/refresh” (optional)
    previous_options: list[str] | None = None  # options cũ (nếu có), để model tránh lặp (optional)

class RefreshQuestionResponse(BaseModel):
    success: bool
    question_text: str | None = None
    question_type: str | None = None
    options: list[str] | None = None
    message: str | None = None

def build_single_question_prompt(req: RefreshQuestionRequest) -> str:
    cat = normalize_category(req.category)
    base = INDUSTRY_TEMPLATES.get(cat, DEFAULT_TEMPLATE)

    guide = f"""
    Chỉ tạo 1 câu hỏi loại: {req.question_type}.
    Yêu cầu:
    - Rõ ràng, không dẫn dắt
    - Nếu là single_choice/multiple_choice: sinh 5-7 lựa chọn, không trùng lặp
    - Nếu là ranking: sinh 5-7 mục để xếp hạng
    - Nếu là rating: dùng thang 1-5
    - Trả về JSON tối giản: question_text, type, options (nếu có)

    Ngữ cảnh survey: "{req.title}"
    """
    if req.previous_question:
        guide += f"\nTránh lặp lại/diễn đạt lại quá giống câu trước: \"{req.previous_question}\""
    if req.previous_options:
        joined = "; ".join(req.previous_options)
        guide += f"\nKhông lặp lại các lựa chọn trước: {joined}"

    if req.ai_prompt:
        guide += f"\nGợi ý bổ sung: {req.ai_prompt.strip()}"

    return f"Tạo 1 câu hỏi chất lượng cao cho survey \"{req.title}\".\n{guide}\nChỉ trả JSON."

@app.post("/refresh_question", response_model=RefreshQuestionResponse)
def refresh_question(req: RefreshQuestionRequest):
    try:
        prompt = build_single_question_prompt(req)

        client: GeminiClient = get_gemini_client()
        gem = getattr(client, "generate_one_question", None)
        if callable(gem):
            gem = client.generate_one_question(prompt=prompt, question_type=req.question_type)
        else:
            gem = client.generate_survey(prompt=prompt, context="", n=1)

        if not gem or (hasattr(gem, "questions") and not gem.questions):
            return RefreshQuestionResponse(success=False, message="AI không trả về câu hỏi.")

        if hasattr(gem, "question"): 
            q = gem.question
        else:
            q = gem.questions[0]

        q_type = _normalize_type(getattr(q, "type", req.question_type))
        q_text = getattr(q, "question_text", "").strip()
        options = getattr(q, "options", None)

        if q_type in ("multiple_choice", "single_choice", "ranking"):
            opts = _coerce_option_list(options)
            if q_type == "ranking" and len(opts) < 5:
                opts += [f"Mục {i}" for i in range(1, max(6 - len(opts), 0) + 1)]
            options = opts
        else:
            options = None

        if not q_text:
            return RefreshQuestionResponse(success=False, message="Câu hỏi rỗng.")

        return RefreshQuestionResponse(
            success=True,
            question_text=q_text,
            question_type=q_type,
            options=options
        )
    except Exception as e:
        return RefreshQuestionResponse(success=False, message=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True
    )