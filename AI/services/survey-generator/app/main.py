"""
Ứng dụng FastAPI cho Dịch vụ Tạo Khảo sát (MAIN.py)
Cung cấp tạo khảo sát thông minh bằng AI sử dụng Gemini API
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from datetime import datetime
from pydantic import BaseModel
from app.core.gemini_client import GeminiOverloadedError
import re, math
load_dotenv()

from math import ceil
SURVEY_AI_FALLBACK = os.getenv("SURVEY_AI_FALLBACK", "1") != "0"


from .models.survey_schemas import (
    SurveyGenerationRequest, 
    SurveyGenerationResponse,
    SurveyGenerationError,
    QuestionSchema,
    GeneratedSurveyResponse,
    CATEGORY_MAPPING
)
from .core.gemini_client import create_gemini_client, GeminiClient

def suggest_followups(q_text: str, q_type: str) -> list[str]:
    t = (q_type or "").lower()
    if t == "open_ended":
        return ["Bạn có thể mô tả ví dụ cụ thể không?", "Yếu tố nào ảnh hưởng lớn nhất đến câu trả lời của bạn?"]
    if t == "rating":
        return ["Lý do bạn chọn mức điểm đó là gì?", "Những cải thiện nào sẽ giúp bạn nâng mức đánh giá?"]
    if t in ("multiple_choice", "single_choice"):
        return ["Yếu tố nào quan trọng nhất khi bạn cân nhắc lựa chọn trên?", "Bạn sẽ đề xuất thêm lựa chọn nào không?"]
    if t == "ranking":
        return ["Tại sao bạn xếp hạng mục A cao hơn mục B?", "Điều gì có thể thay đổi thứ tự ưu tiên của bạn?"]
    if t == "date_time":
        return ["Khung giờ thay thế phù hợp với bạn?", "Bạn có cần đặt nhắc nhở không?"]
    if t == "boolean_":
        return ["Điều gì dẫn đến quyết định có/không của bạn?", "Trong trường hợp nào bạn sẽ chọn ngược lại?"]
    if t == "file_upload":
        return ["Bạn có tài liệu minh hoạ/đính kèm bổ sung không?", "Bạn cần hướng dẫn về định dạng tệp không?"]
    return []

PARALLEL_WORKERS = int(os.getenv("SURVEY_AI_WORKERS", "2"))
SINGLE_TIMEOUT   = int(os.getenv("SURVEY_AI_SINGLE_TIMEOUT", "18"))
MIN_SCORE        = int(os.getenv("SURVEY_AI_MIN_SCORE", "55"))

def _gen_one_safe(client: GeminiClient, req: SurveyGenerationRequest, qtype: Optional[str]):
    try:
        # Dùng prompt 1-câu đúng chuẩn
        single_req = RefreshQuestionRequest(
            title=req.title,
            category=req.category_name or "general",
            question_type=qtype or "open_ended",
            ai_prompt=req.ai_prompt or "",
            previous_question=""
        )
        one_prompt = build_single_question_prompt(single_req)
        return client.generate_one_question(prompt=one_prompt, context=req.description or "")
    except Exception:
        return {}


def parallel_generate_exact_n(client: GeminiClient, req: SurveyGenerationRequest) -> list[dict]:
    """Sinh đúng N câu bằng cách bắn nhiều request 1-câu song song theo 'waves' cho tới khi đủ."""
    N = int(req.number_of_questions)
    target_types = choose_target_types(N)

    results: list[dict] = []
    seen = set()

    wave = 0
    while len(results) < N and wave < 10:  # tối đa 10 đợt (thường 1–3 là đủ)
        wave += 1

        # Lập danh sách loại cần sinh ở đợt này (còn thiếu loại nào thì đẩy trước)
        missing = N - len(results)
        types_needed = target_types[len(results): len(results) + missing]
        # tăng thêm một chút để có dư mà lọc
        extra = choose_target_types(max(0, missing//2))
        wanted_types = types_needed + extra

        with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as ex:
            futs = [ex.submit(_gen_one_safe, client, req, t) for t in wanted_types]
            for fut in as_completed(futs, timeout=SINGLE_TIMEOUT * len(futs)):
                one = fut.result() or {}
                q_text = (one.get("question_text") or "").strip()
                if not q_text:
                    continue

                key = q_text.lower()
                if key in seen:
                    continue

                q_type = _normalize_type(one.get("question_type") or "open_ended")
                options = one.get("options")

                if q_type in ("multiple_choice", "single_choice", "ranking"):
                    opts = _coerce_option_list(options)
                    if q_type == "ranking" and len(opts) < 5:
                        for j in range(len(opts)+1, 6):
                            opts.append(f"Mục {j}")
                    options = opts
                else:
                    options = None

                issues = validate_question_text(q_text)
                score  = score_question(q_text)

                # lọc placeholder/điểm thấp:
                if issues or score < MIN_SCORE:
                    continue

                results.append({
                    "question_text": q_text,
                    "type": q_type,
                    "options": options,
                    "score": score,
                    "issues": issues
                })
                seen.add(key)

                if len(results) >= N:
                    break

    # Nếu vẫn thiếu một ít, bạn có thể gọi thêm 1 wave nữa hoặc fallback cứng (tuỳ bạn).
    return results[:N]

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
SUPPORTED_TYPES = ["multiple_choice","single_choice","ranking","rating","open_ended","boolean_","date_time","file_upload"]

def choose_target_types(n: int) -> list[str]:
    wheel = ["single_choice","multiple_choice","rating","ranking","boolean_","open_ended","date_time","file_upload"]
    out = []
    i = 0
    while len(out) < max(1, n):
        out.append(wheel[i % len(wheel)])
        i += 1
    return out[:n]

def _ensure_min_options(qtype: str, options: list | None) -> list[dict]:
    # Chuẩn hoá về list[dict(option_text, display_order)] nhưng KHÔNG set cứng A/B/C/D cho MCQ/Single
    opts = options or []
    normalized = []
    for i, o in enumerate(opts):
        if isinstance(o, dict) and (o.get("option_text") or "").strip():
            normalized.append({"option_text": o["option_text"].strip(), "display_order": i+1})
        elif isinstance(o, str) and o.strip():
            normalized.append({"option_text": o.strip(), "display_order": i+1})

    if qtype == "ranking":
        # Ranking cần đủ item để sắp thứ hạng mượt
        if len(normalized) < 5:
            need = 5 - len(normalized)
            normalized += [{"option_text": f"Mục {k}", "display_order": len(normalized)+k} for k in range(1, need+1)]
    elif qtype in ("multiple_choice", "single_choice"):
        # KHÔNG tự thêm bất kỳ lựa chọn nào; để rỗng nếu AI chưa sinh đủ
        pass
    else:
        # Các loại khác không có options
        normalized = []

    # Re-index display_order
    for i, o in enumerate(normalized, start=1):
        o["display_order"] = i
    return normalized


def enforce_type_mix(generated: list[dict], target_types: list[str]) -> list[dict]:
    map_alias = {
        "boolean":"boolean_","yes_no":"boolean_","true_false":"boolean_",
        "date":"date_time","datetime":"date_time","time":"date_time","time_picker":"date_time",
        "file":"file_upload","upload":"file_upload","attachment":"file_upload",
        "single":"single_choice","radio":"single_choice",
        "mcq":"multiple_choice","multiple":"multiple_choice","multi_choice":"multiple_choice","checkbox":"multiple_choice"
    }
    out = []
    for i, q in enumerate(generated):
        want = target_types[i] if i < len(target_types) else None
        raw_t = (q.get("type") or q.get("question_type") or "").strip().lower().replace("-", "_").replace(" ", "_")
        got = map_alias.get(raw_t, raw_t) or "open_ended"
        qtype = want or got
        if want and got != want:
            qtype = want
        qtext = q.get("question_text") or q.get("text") or q.get("question") or f"Câu hỏi {i+1}"
        options = _ensure_min_options(qtype, q.get("options") or q.get("options_list") or [])
        str_opts = [o["option_text"] for o in options] if options else None
        out.append({"question_text": qtext, "type": qtype, "options": str_opts})
    return out

# 2) Helpers: chuẩn hoá category, build prompt, validate + score
def normalize_category(cat) -> str:
    from app.models.survey_schemas import CATEGORY_MAPPING
    if cat is None:
        return "general"
    if isinstance(cat, int) and cat in CATEGORY_MAPPING:
        return str(CATEGORY_MAPPING[cat]).strip().lower()
    return str(cat).strip().lower()

def _coerce_option_texts(options) -> list[str]:
    """
    Nhận mọi kiểu: None / list[str] / list[dict] / tạp.
    Trả về list[str] sạch, không rỗng, tối đa 7 mục.
    """
    if not options:
        return []
    out = []
    for o in options:
        if isinstance(o, dict):
            txt = (o.get("option_text")
                   or o.get("text")
                   or o.get("label")
                   or o.get("value")
                   or "").strip()
        else:
            txt = str(o).strip()
        # gỡ noise kiểu "option_text: 'xxx', display_order: 2"
        if txt.lower().startswith("option_text"):
            m = re.search(r"option_text\s*[:=]\s*['\"]([^'\"]+)['\"]", txt, flags=re.I)
            if m:
                txt = m.group(1).strip()
        if txt:
            out.append(txt)

    # loại trùng + cắt ngắn
    seen, uniq = set(), []
    for t in out:
        if t.lower() not in seen:
            seen.add(t.lower())
            uniq.append(t)
    return uniq[:7]


def regen_low_quality_questions(
    title: str,
    category: str,
    items: list[dict],
    client,  # gemini_client instance
    max_regen: int = 5
) -> list[dict]:
    """
    Thử làm mới tối đa max_regen câu kém chất lượng bằng generate_one_question.
    items: list các bản ghi {"question_text","type","options","score","issues"}
    """
    out = []
    regen_count = 0
    for it in items:
        qtext = it["question_text"]
        qtype = it["type"]
        issues = it.get("issues", [])

        if regen_count < max_regen and ("placeholder_text" in issues or it.get("score", 0) < 65):
            # chuẩn bị prompt ngắn, cụ thể để tăng chất lượng
            hint = (
                "Tạo 1 câu hỏi rõ ràng, tự nhiên, tránh placeholder. "
                "Nếu là multiple_choice/single_choice/ranking: sinh 3–5 lựa chọn thực tế; "
                "với date_time/file_upload: KHÔNG có options. Chỉ trả JSON."
            )
            one = client.generate_one_question(
                title=title,
                category=category or "general",
                question_type=qtype,
                ai_prompt=hint,
                previous_question=qtext or "placeholder"
            )
            if one and one.get("question_text"):
                # ghép lại record mới, giữ type đã cân bằng
                out.append({
                    "question_text": one["question_text"].strip(),
                    "type": qtype,
                    "options": one.get("options")
                })
                regen_count += 1
                continue  # sang câu tiếp theo
        # nếu không regen, giữ nguyên
        out.append({"question_text": qtext, "type": qtype, "options": it.get("options")})
    return out



def validate_question_text(q: str) -> List[str]:
    """Rule-based validation: phát hiện lỗi phổ biến."""
    issues: List[str] = []
    if not q or len(q.strip()) < 8:
        issues.append("Câu hỏi quá ngắn/không rõ.")
    low = q.lower()
    if q.lower().startswith("câu hỏi "):
        issues.append("placeholder_text")

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

    # Over-generate có trần để tránh bể token JSON:
    base_n = max(1, int(req.number_of_questions or 1))
    cap = 20 
    N_over = min(max(base_n, math.ceil(base_n * 1.6)), cap)

    extra = []
    if getattr(req, "ai_prompt", None):
        extra.append(req.ai_prompt.strip())
    if getattr(req, "description", None):
        extra.append(req.description.strip())
    context = "\nNgữ cảnh bổ sung từ người dùng:\n" + "\n".join(extra) if extra else ""

    final_prompt = tmpl.format(
        n=N_over,
        title=req.title,
        types=types_text
    ) + context

    target_types = choose_target_types(N_over)
    final_prompt += f"\nPhân bổ loại câu hỏi THEO THỨ TỰ: {target_types}."
    final_prompt += "\nCHỈ trả JSON hợp lệ (không markdown, không chú thích)."
    final_prompt += "\nMỗi câu hỏi phải cụ thể, KHÔNG dùng placeholder như 'Câu hỏi 1'."

    return final_prompt

def generate_many_questions(client: GeminiClient, req: SurveyGenerationRequest) -> List[Dict[str, Any]]:
    target_total = max(1, req.number_of_questions)
    collected: List[Dict[str, Any]] = []
    seen = set()  # tránh trùng

    # batch cố định 8–12 câu/lần (tránh MAX_TOKENS)
    BATCH_CAP = 12

    while len(collected) < target_total:
        remain = target_total - len(collected)
        # mỗi batch xin dư 1.5x nhưng cap 12
        ask_n = min(max(remain, ceil(remain * 1.5)), BATCH_CAP)

        # tạm clone req với số câu = ask_n
        tmp_req = SurveyGenerationRequest(**{**req.dict(), "number_of_questions": ask_n})
        prompt = build_prompt(tmp_req)

        gem_res = client.generate_survey(prompt=prompt, context=tmp_req.description or "")
        if not gem_res or not getattr(gem_res, "questions", None):
            # nếu batch này rỗng, thoát sớm để tránh vòng lặp vô hạn
            break

        # chấm điểm + lọc trùng + lọc placeholder + ép options tối thiểu
        batch = []
        for q in gem_res.questions:
            q_text = (q.question_text or "").strip()
            key = q_text.lower()
            if not q_text or key.startswith("câu hỏi "):
                continue
            if key in seen:
                continue
            q_type = _normalize_type(getattr(q, "question_type", getattr(q, "type", "open_ended")))
            options = getattr(q, "options", None)
            if q_type in ("multiple_choice", "single_choice", "ranking"):
                opts = _coerce_option_list(options)
                if q_type == "ranking" and len(opts) < 5:
                    need = 5 - len(opts)
                    opts += [f"Mục {i}" for i in range(1, need + 1)]
                options = opts
            else:
                options = None

            issues = validate_question_text(q_text)
            score = score_question(q_text)
            batch.append({"question_text": q_text, "type": q_type, "options": options, "score": score, "issues": issues})

        # ưu tiên câu không issue + điểm cao
        batch.sort(key=lambda x: (len(x["issues"]) == 0, x["score"]), reverse=True)

        # lấy vừa đủ phần còn thiếu
        for it in batch:
            if len(collected) >= target_total:
                break
            if it["issues"] or it["score"] < 65:
                continue  # giữ chất lượng
            collected.append(it)
            seen.add(it["question_text"].lower())

        # nếu vẫn thiếu nhiều, vòng while sẽ xin batch tiếp theo

    return collected

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
    if t in ["date", "datetime", "date_time", "time", "time_picker"]:
        return "date_time"
    if t in ["file", "upload", "file_upload", "attachment"]:
        return "file_upload"
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
    import logging
    logging.getLogger("app.core.gemini_client").setLevel(logging.DEBUG)
    logging.getLogger().setLevel(logging.INFO)  # giữ INFO cho global, DEBUG riêng gemini_client

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
        client: GeminiClient = get_gemini_client()
        N = int(request.number_of_questions)

        # 1) Gọi AI với BIG PROMPT
        prompt = build_prompt(request)
        gem_res = client.generate_survey(prompt=prompt, context=request.description or "")

        # ---- Helpers nội bộ ----
        def _score_and_normalize(q_obj, idx: int) -> dict:
            q_text = (getattr(q_obj, "question_text", "") or "").strip()
            q_type = _normalize_type(getattr(q_obj, "type", getattr(q_obj, "question_type", "open_ended")))
            opts = getattr(q_obj, "options", None)

            if q_type in ("multiple_choice", "single_choice", "ranking"):
                options = _coerce_option_texts(opts)
                if q_type == "ranking" and len(options) < 5:
                    need = 5 - len(options)
                    options += [f"Mục {k}" for k in range(1, need + 1)]
            else:
                options = []

            issues = validate_question_text(q_text)
            score = score_question(q_text)
            return {
                "question_text": q_text or f"Câu hỏi {idx}",
                "type": q_type,
                "options": options,
                "score": score,
                "issues": issues
            }

        def _dedup_merge(base: list[dict], extra: list[dict]) -> list[dict]:
            merged, seen = [], set()
            for x in (base + extra):
                qt = (x.get("question_text") or "").strip()
                key = qt.lower()
                if not qt or key in seen:
                    continue
                seen.add(key)
                merged.append(x)
            return merged

        def _pick_valid(items: list[dict], limit: int) -> list[dict]:
            # sort theo score cao & ít issues
            items_sorted = sorted(items, key=lambda x: (x.get("score", 0), -len(x.get("issues", []))), reverse=True)
            out = []
            for it in items_sorted:
                if len(out) >= limit:
                    break
                qt = (it["question_text"] or "").strip().lower()
                # loại placeholder "câu hỏi ..." hoặc rỗng
                if not qt or qt.startswith("câu hỏi "):
                    continue
                if it.get("score", 0) >= MIN_SCORE and not it.get("issues"):
                    out.append(it)
            return out

        # 2) Parse -> chấm điểm -> build 'parsed'
        parsed: list[dict] = []
        if gem_res and getattr(gem_res, "questions", None):
            for i, q in enumerate(gem_res.questions, start=1):
                parsed.append(_score_and_normalize(q, i))

        # 2b) Loại MCQ/Single thiếu options (tránh fallback A/B/C)
        cleaned = []
        for it in parsed:
            qtype = it.get("type")
            opts = it.get("options") or []
            if qtype in ("multiple_choice", "single_choice"):
                if len([o for o in opts if (o or "").strip()]) < 2:
                    continue
            cleaned.append(it)
        parsed = cleaned

        # 3) Nếu thiếu hoặc >50% kém → sinh song song để BÙ ĐỦ N (đợt 1)
        need_more = N - sum(1 for x in parsed if (x["score"] >= MIN_SCORE and not x["issues"]))
        too_many_bad = sum(1 for x in parsed if (x["score"] < MIN_SCORE or x["issues"])) > max(2, len(parsed) // 2)
        if need_more > 0 or too_many_bad:
            exact = parallel_generate_exact_n(client, request)
            parsed = _dedup_merge(parsed, exact)

        # 3b) LOOP fill cho đến đủ N (tối đa 3 lần)
        attempts = 0
        while attempts < 3:
            valid_now = _pick_valid(parsed, N)
            remaining = N - len(valid_now)
            if remaining <= 0:
                break

            # Gọi bù đúng số còn thiếu
            req_rem = SurveyGenerationRequest(**{**request.dict(), "number_of_questions": remaining})
            extra = parallel_generate_exact_n(client, req_rem)
            parsed = _dedup_merge(parsed, extra)
            attempts += 1

        # 4) Chọn Top-N theo score & không placeholder
        topN = _pick_valid(parsed, N)

        # 5) Fallback mềm (không pad MCQ/SC)
        if len(topN) < N and SURVEY_AI_FALLBACK:
            need = N - len(topN)
            padding_types = choose_target_types(need)
            for idx, t in enumerate(padding_types, start=1):
                if t in ("multiple_choice", "single_choice"):
                    t = "rating"  # an toàn
                qtext = f"Câu hỏi bổ sung {idx}: vui lòng cho biết ý kiến của bạn."
                opts = []
                if t == "ranking":
                    opts = ["Mục 1", "Mục 2", "Mục 3", "Mục 4", "Mục 5"]
                topN.append({"question_text": qtext, "type": t, "options": opts})

        # Nếu vẫn <3 và có fallback → pad tới 3
        if len(topN) < 3 and SURVEY_AI_FALLBACK:
            need = 3 - len(topN)
            padding_types = choose_target_types(need)
            for idx, t in enumerate(padding_types, start=1):
                if t in ("multiple_choice", "single_choice"):
                    t = "open_ended"
                qtext = f"Câu hỏi bổ sung {idx}: vui lòng cho biết ý kiến của bạn."
                opts = []
                if t == "ranking":
                    opts = ["Mục 1", "Mục 2", "Mục 3", "Mục 4", "Mục 5"]
                topN.append({"question_text": qtext, "type": t, "options": opts})

        if not topN:
            return SurveyGenerationResponse(
                success=False,
                message="AI không trả về câu hỏi hợp lệ.",
                error_details={"hint": "no_valid_questions"}
            )

        # 6) Cắt đúng N (nhưng đảm bảo tối thiểu 3)
        topN = topN[:max(3, N)]

        # 7) Build response theo schema Pydantic
        gen = GeneratedSurveyResponse(
            title=request.title,
            description=request.description,
            questions=[
                QuestionSchema(
                    question_text=it["question_text"],
                    question_type=it["type"],
                    is_required=True,
                    display_order=i + 1,
                    options=[{"option_text": o, "display_order": j + 1} for j, o in enumerate(it.get("options") or [])]
                )
                for i, it in enumerate(topN)
            ]
        )

        return SurveyGenerationResponse(
            success=True,
            survey_id=None,
            message="Tạo câu hỏi thành công",
            generated_survey=gen
        )

    except GeminiOverloadedError:
        raise HTTPException(status_code=503, detail="AI provider đang quá tải (503). Vui lòng thử lại.")
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
    - Nếu là date_time: chỉ định ngày/giờ; không có options
    - Nếu là file_upload: không có options; mô tả loại tệp nếu cần
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
    """
    Sinh lại 1 câu (nhanh), chấp nhận đầu ra đôi khi lộn xộn và ép về schema FE cần.
    Không còn lỗi 'str'.get vì luôn kiểm tra kiểu dữ liệu trước khi truy cập.
    """
    try:
        client: GeminiClient = get_gemini_client()

        raw = client.generate_one_question(
            title=req.title or "",
            category=(req.category or "general"),
            question_type=req.question_type,
            ai_prompt=req.ai_prompt or "",
            previous_question=req.previous_question or "",
        )

        # 1) Bảo vệ kiểu dữ liệu
        if not isinstance(raw, dict):
            return RefreshQuestionResponse(success=False, message="AI không trả về JSON hợp lệ.")

        # 2) Lấy trường với nhiều biến thể, ép loại & ép options
        q_text = (raw.get("question_text") or raw.get("text") or raw.get("question") or "").strip()
        q_type = _normalize_type(raw.get("question_type") or raw.get("type") or "open_ended")

        if not q_text:
            return RefreshQuestionResponse(success=False, message="AI không trả về câu hợp lệ.")

        options = []
        if q_type in ("multiple_choice", "single_choice", "ranking"):
            options = _coerce_option_texts(raw.get("options"))
            # ranking cần tối thiểu 5 mục để xếp hạng mượt
            if q_type == "ranking" and len(options) < 5:
                need = 5 - len(options)
                options += [f"Mục {i}" for i in range(1, need + 1)]
        else:
            options = []

        return RefreshQuestionResponse(
            success=True,
            question_text=q_text,
            question_type=q_type,
            options=options or None
        )

    except GeminiOverloadedError:
        raise HTTPException(status_code=503, detail="AI provider đang quá tải (503). Vui lòng thử lại.")
    except Exception as e:
        # Trả message rõ ràng cho FE
        return RefreshQuestionResponse(success=False, message=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True
    )