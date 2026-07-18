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
import re, math, random
from pathlib import Path
from collections import Counter

# Load .env từ thư mục gốc của project
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

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
from .core.openai_client import create_openai_client, OpenAIClient

# Determine AI provider
AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini").lower()

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

def _gen_one_safe(client, req: SurveyGenerationRequest, qtype: Optional[str]):
    """Generate one question safely - works with both Gemini and OpenAI clients"""
    try:
        result = client.generate_one_question(
            title=req.title,
            category=req.category_name or "general",
            question_type=qtype or "open_ended",
            ai_prompt=req.ai_prompt or "",
            previous_question=""
        )
        if not result or not result.get("question_text"):
            logger.warning(f"⚠️ Empty result from generate_one_question for type={qtype}")
        return result
    except Exception as e:
        logger.error(f"❌ Exception in _gen_one_safe for type={qtype}: {e}", exc_info=True)
        return {}


def parallel_generate_exact_n(client, req: SurveyGenerationRequest) -> list[dict]:
    """Sinh đúng N câu bằng cách bắn nhiều request 1-câu song song theo 'waves' cho tới khi đủ."""
    N = int(req.number_of_questions)
    priorities = getattr(req, "question_type_priorities", None)
    logger.info(f"🎯 Priority selection: N={N}, priorities={priorities}")
    target_types = choose_target_types(N, priorities)
    logger.info(f"📊 Target types generated: {target_types}")

    results: list[dict] = []
    seen = set()
    
    # 🔥 SAFETY LIMITS
    MIN_ACCEPTABLE = min(N, max(3, int(N * 0.6)))  # Tối thiểu 60% số câu hoặc 3 câu (không vượt quá N)
    MAX_RETRIES_PER_QUESTION = 1  # Chỉ retry 1 lần/câu
    QUOTA_ERRORS = 0  # Track số lần gặp 429
    MAX_QUOTA_ERRORS = 3  # Dừng sau 3 lần 429

    wave = 0
    while len(results) < N and wave < 5:  # ✅ Giảm từ 10 → 5 waves
        wave += 1

        # Lập danh sách loại cần sinh ở đợt này (còn thiếu loại nào thì đẩy trước)
        missing = N - len(results)
        types_needed = target_types[len(results): len(results) + missing]
        # tăng thêm một chút để có dư mà lọc
        extra = choose_target_types(max(0, missing//2), priorities)
        wanted_types = types_needed + extra

        # ✅ FIX: Giữ đúng thứ tự bằng cách dùng list index thay vì as_completed
        with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as ex:
            # Submit với index và type để track
            indexed_futs = [(i, t, ex.submit(_gen_one_safe, client, req, t)) for i, t in enumerate(wanted_types)]
            
            # Đợi tất cả futures hoàn thành và sort theo index gốc
            completed = []
            for idx, expected_type, fut in indexed_futs:
                try:
                    one = fut.result(timeout=SINGLE_TIMEOUT) or {}
                    completed.append((idx, expected_type, one))
                except Exception as e:
                    logger.warning(f"⚠️ Failed to generate question at index {idx} (type={expected_type}): {e}")
                    continue
            
            # Sort theo index để giữ đúng thứ tự priorities
            completed.sort(key=lambda x: x[0])
            
            for idx, expected_type, one in completed:
                q_text = (one.get("question_text") or "").strip()
                if not q_text:
                    logger.warning(f"⚠️ Question at index {idx} has no text (expected={expected_type})")
                    
                    # 🔥 CHECK: Dừng retry nếu đã vượt quota error limit
                    if QUOTA_ERRORS >= MAX_QUOTA_ERRORS:
                        logger.error(f"🛑 STOP: Đã gặp {QUOTA_ERRORS} quota errors. Dừng retry để tránh spam API!")
                        break
                    
                    # 🔥 CHECK: Dừng retry nếu đã đủ minimum acceptable
                    if len(results) >= MIN_ACCEPTABLE:
                        logger.info(f"✅ Đã đủ {len(results)}/{N} câu (minimum: {MIN_ACCEPTABLE}). Skip retry.")
                        continue
                    
                    # ✨ RETRY: Chỉ retry 1 lần/câu với priority
                    if priorities and expected_type and wave <= 2:  # Chỉ retry trong 2 waves đầu
                        logger.info(f"🔄 Retrying generation for type={expected_type} at index {idx}")
                        try:
                            retry_result = _gen_one_safe(client, req, expected_type)
                            if retry_result and retry_result.get("question_text"):
                                one = retry_result
                                q_text = one.get("question_text", "").strip()
                                logger.info(f"✅ Retry successful for {expected_type}")
                            else:
                                logger.warning(f"❌ Retry failed for {expected_type}, skipping")
                                QUOTA_ERRORS += 1  # Increment on empty result
                                continue
                        except Exception as e:
                            error_msg = str(e).lower()
                            if "429" in error_msg or "quota" in error_msg:
                                QUOTA_ERRORS += 1
                                logger.error(f"🚫 Quota exceeded during retry ({QUOTA_ERRORS}/{MAX_QUOTA_ERRORS})")
                            continue
                    else:
                        continue

                key = q_text.lower()
                if key in seen:
                    logger.debug(f"🔄 Duplicate question skipped at index {idx}")
                    continue

                q_type = _normalize_type(one.get("question_type") or "open_ended")
                logger.info(f"📝 Question {idx}: expected={expected_type}, got={q_type}, text='{q_text[:50]}...'")
                
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

                # ⚠️ CRITICAL: Với priorities, BẮT BUỘC type phải match
                if priorities and len(results) < N:
                    # Kiểm tra type có match với expected không
                    if q_type != expected_type:
                        logger.warning(f"❌ Type mismatch at {idx}: expected={expected_type}, got={q_type}. SKIPPING.")
                        continue
                    
                    # Với priorities, ưu tiên đủ số lượng hơn quality
                    if not issues:  # Chỉ bỏ nếu có issues nghiêm trọng
                        logger.info(f"✅ Accepted question {idx} with type={q_type} (priority mode)")
                        results.append({
                            "question_text": q_text,
                            "type": q_type,
                            "options": options,
                            "score": score,
                            "issues": issues
                        })
                        seen.add(key)
                    else:
                        logger.warning(f"⚠️ Question {idx} has issues: {issues}")
                else:
                    # Không có priorities, giữ logic cũ (filter theo score)
                    if not issues and score >= MIN_SCORE:
                        results.append({
                            "question_text": q_text,
                            "type": q_type,
                            "options": options,
                            "score": score,
                            "issues": issues
                        })
                        seen.add(key)

                if len(results) >= N:
                    logger.info(f"✅ Đã đủ {N} câu hỏi, stop generating.")
                    break
            
            # 🔥 BREAK: Dừng wave loop nếu gặp quá nhiều quota errors
            if QUOTA_ERRORS >= MAX_QUOTA_ERRORS:
                logger.error(f"🛑 STOP WAVES: Đã gặp {QUOTA_ERRORS} quota errors. Dừng tất cả generation!")
                break
            
            # 🔥 EARLY EXIT: Nếu đã đủ minimum và đang gặp vấn đề API
            if len(results) >= MIN_ACCEPTABLE and QUOTA_ERRORS > 0:
                logger.warning(f"⚠️ EARLY EXIT: Đã có {len(results)}/{N} câu (đủ minimum {MIN_ACCEPTABLE}). Dừng để tiết kiệm API.")
                break

    # Log final results
    logger.info(f"🎯 Final result: generated {len(results)}/{N} questions")
    if len(results) < N:
        if len(results) >= MIN_ACCEPTABLE:
            logger.warning(f"⚠️ Thiếu {N - len(results)} câu nhưng đã đạt minimum acceptable ({len(results)}/{MIN_ACCEPTABLE})")
        else:
            logger.error(f"❌ Chỉ tạo được {len(results)}/{N} câu (minimum: {MIN_ACCEPTABLE})")
    
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

def choose_target_types(n: int, priorities: list[str] | None = None) -> list[str]:
    """
    Chọn danh sách loại câu hỏi theo mức độ ưu tiên.
    
    Args:
        n: Số lượng câu hỏi cần tạo
        priorities: Danh sách loại câu hỏi ưu tiên theo thứ tự (nếu None sẽ dùng mặc định)
    
    Returns:
        Danh sách loại câu hỏi theo thứ tự ưu tiên
    """
    # Nếu không có priorities, dùng mặc định với rating, single_choice, multiple_choice ưu tiên cao hơn
    if not priorities or len(priorities) == 0:
        # Mặc định: ưu tiên rating, single_choice, multiple_choice (xuất hiện nhiều hơn)
        wheel = [
            "rating", "single_choice", "multiple_choice",  # Ưu tiên cao - lặp lại 2 lần
            "rating", "single_choice", "multiple_choice",
            "ranking", "boolean_", "open_ended",  # Ưu tiên trung bình
            "date_time", "file_upload"  # Ưu tiên thấp
        ]
    else:
        # ✅ GUARANTEED DISTRIBUTION: Mỗi priority type PHẢI xuất hiện ít nhất 1 lần
        priority_count = len(priorities)
        
        # BƯỚC 1: Đảm bảo mỗi priority có ít nhất 1 câu
        result = list(priorities)  # Copy để không ảnh hưởng tham số gốc
        remaining_slots = n - priority_count
        
        if remaining_slots <= 0:
            # Nếu số câu <= số priorities → chỉ lấy n đầu tiên
            return result[:n]
        
        # BƯỚC 2: Phân phối các slot còn lại theo weighted priority
        # Tạo weighted wheel: priority càng cao (index càng thấp) → xuất hiện càng nhiều
        wheel = []
        for idx, qtype in enumerate(priorities):
            # Weight = priority_count - idx (càng đầu càng nặng)
            # VD: 4 priorities -> weights = [4, 3, 2, 1]
            weight = priority_count - idx
            wheel.extend([qtype] * weight)
        
        # BƯỚC 3: Random sample từ wheel để fill các slot còn lại
        import random
        additional = random.choices(wheel, k=remaining_slots)
        result.extend(additional)
        
        # Shuffle để tránh pattern quá rõ ràng (nhưng vẫn giữ distribution)
        random.shuffle(result)
        
        logger.info(f"📊 Distribution: {dict(Counter(result))}")
        return result[:n]

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

    # Sử dụng priorities từ request nếu có
    priorities = getattr(req, "question_type_priorities", None)
    target_types = choose_target_types(N_over, priorities)
    
    if priorities:
        final_prompt += f"\nƯU TIÊN các loại câu hỏi theo thứ tự: {', '.join(priorities[:5])}."
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
_frontend_url = os.getenv("FRONTEND_URL", "")
_allowed_origins = ["http://localhost:5173", "http://localhost:8080", "http://localhost:3000"]
if _frontend_url:
    _allowed_origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global AI client (Gemini or OpenAI)
_ai_client = None

def get_ai_client():
    """Dependency để lấy AI client (Gemini hoặc OpenAI)"""
    global _ai_client
    if _ai_client is None:
        provider = os.getenv("AI_PROVIDER", "gemini").lower()
        
        if provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise HTTPException(
                    status_code=500,
                    detail="Chưa cấu hình OpenAI API key"
                )
            _ai_client = create_openai_client(api_key)
            logger.info("✅ Sử dụng OpenAI API")
        else:
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise HTTPException(
                    status_code=500,
                    detail="Chưa cấu hình Gemini API key"
                )
            _ai_client = create_gemini_client(api_key)
            logger.info("✅ Sử dụng Gemini API")
    
    return _ai_client

# Backward compatibility alias
def get_gemini_client():
    """Deprecated: Use get_ai_client() instead"""
    return get_ai_client()

@app.on_event("startup")
async def startup_event():
    """Khởi tạo các dịch vụ khi startup"""
    import logging
    logging.getLogger("app.core.gemini_client").setLevel(logging.DEBUG)
    logging.getLogger("app.core.openai_client").setLevel(logging.DEBUG)
    logging.getLogger().setLevel(logging.INFO)
    
    logger.info("🚀 Dịch vụ Tạo Khảo sát đang khởi động...")
    
    # Xác minh AI provider và API key
    provider = os.getenv("AI_PROVIDER", "gemini").lower()
    
    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.warning("⚠️ Chưa thiết lập OPENAI_API_KEY")
        else:
            logger.info("✅ Sử dụng OpenAI API")
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning("⚠️ Chưa thiết lập GEMINI_API_KEY")
        else:
            logger.info("✅ Sử dụng Gemini API")

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
        logger.info(f"📥 Received generation request: N={request.number_of_questions}, priorities={request.question_type_priorities}")
        logger.info(f"🔍 Request details: title={request.title}, category={request.category_name}")
        logger.info(f"🔍 Full request dict: {request.model_dump()}")
        
        client: GeminiClient = get_gemini_client()
        N = int(request.number_of_questions)

        # ✅ CRITICAL FIX: Nếu có priorities, BỎ QUA BIG PROMPT, chỉ dùng parallel
        priorities = request.question_type_priorities
        if priorities and len(priorities) > 0:
            logger.info(f"🎯 Priority mode enabled! Bypassing BIG PROMPT, using parallel generation only.")
            # Tạo trực tiếp với parallel để đảm bảo đúng type
            parsed = parallel_generate_exact_n(client, request)
            gem_res = None  # Không dùng BIG PROMPT
        else:
            # 1) Gọi AI với BIG PROMPT (chỉ khi không có priorities)
            logger.info("📝 No priorities, using BIG PROMPT mode")
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

        # 2) Parse -> chấm điểm -> build 'parsed' (chỉ khi dùng BIG PROMPT)
        if not priorities:
            # BIG PROMPT mode: parse kết quả
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

            # 3b) LOOP fill cho đến đủ N (tối đa 3 lần) - chỉ khi không có priorities
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
        # else: priorities mode đã có parsed từ parallel_generate_exact_n()

        # 4) Chọn Top-N theo score & không placeholder
        topN = _pick_valid(parsed, N)

        # 5) Kiểm tra số lượng câu hỏi hợp lệ - KHÔNG DÙNG FALLBACK CỨ
        if not topN:
            logger.error(f"❌ AI không sinh được câu hỏi hợp lệ nào. Parsed: {len(parsed)}, Valid: 0")
            return SurveyGenerationResponse(
                success=False,
                message="AI không thể tạo câu hỏi phù hợp. Vui lòng thử lại với prompt rõ ràng hơn hoặc giảm số lượng câu hỏi.",
                error_details={
                    "hint": "no_valid_questions",
                    "parsed_count": len(parsed),
                    "suggestions": [
                        "Thử giảm số lượng câu hỏi (3-5 câu)",
                        "Làm rõ hơn prompt/mô tả",
                        "Kiểm tra kết nối API"
                    ]
                }
            )
        
        # 5b) Nếu thiếu một ít (< 50%), cảnh báo nhưng vẫn trả về
        if len(topN) < N:
            shortage = N - len(topN)
            logger.warning(f"⚠️ Chỉ sinh được {len(topN)}/{N} câu hỏi hợp lệ. Thiếu {shortage} câu.")
            # Không pad thêm câu rác, chỉ trả về số có được
        
        # 5c) Nếu quá ít câu (< 50% yêu cầu), trả lỗi thay vì trả câu rác
        if len(topN) < min(N, max(3, N // 2)):
            logger.error(f"❌ Chỉ sinh được {len(topN)}/{N} câu ({len(topN)*100//N}%), quá thấp!")
            return SurveyGenerationResponse(
                success=False,
                message=f"Chỉ tạo được {len(topN)}/{N} câu hỏi hợp lệ. Vui lòng thử lại với yêu cầu đơn giản hơn.",
                error_details={
                    "hint": "insufficient_quality",
                    "generated": len(topN),
                    "requested": N,
                    "suggestions": [
                        "Giảm số câu hỏi xuống 3-5",
                        "Cung cấp prompt cụ thể hơn",
                        "Kiểm tra API key còn quota"
                    ]
                }
            )

        # 6) Cắt đúng N (không cần tối thiểu 3 nữa)
        topN = topN[:N]

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
        logger.error(f"❌ LỖI KHI TẠO KHẢO SÁT: {type(e).__name__}: {str(e)}", exc_info=True)
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