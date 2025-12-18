"""
Gemini API Client cho Tạo Khảo sát (gemini_client)
Xử lý giao tiếp với Google Gemini API để tạo khảo sát thông minh
"""

import json
import logging
import re,os
import time, random
from typing import Dict, Any, Optional, List
import requests
import base64 
from dataclasses import dataclass
try:
    from ..models.survey_schemas import GeneratedSurveyResponse
except Exception:
    from app.models.survey_schemas import GeneratedSurveyResponse

logger = logging.getLogger(__name__)

class GeminiOverloadedError(Exception):
    """Ném khi Gemini quá tải (429/503) sau khi đã retry."""
    pass

@dataclass
class GeminiConfig:
    api_key: str
    base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    model: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    temperature: float = 0.4
    max_tokens: int = 8192
    
    # Fallback chain: thứ tự ưu tiên models khi gặp rate limit
    fallback_models: List[str] = None
    
    def __post_init__(self):
        if self.fallback_models is None:
            # Chỉ dùng models có trong Google AI Studio free tier
            # Dựa vào quota: gemini-2.5-flash (5 RPM), gemini-2.5-flash-lite (10 RPM)
            self.fallback_models = [
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite"
            ]

    # Alias để code cũ gọi self.config.model_name vẫn chạy
    @property
    def model_name(self) -> str:
        return self.model

SURVEY_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question_text": {"type": "string"},
                    "question_type": {"type": "string"},
                    "options": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                },
                "required": ["question_text", "question_type"]
            }
        }
    },
    "required": ["questions"]
}

ONE_QUESTION_SCHEMA = {
    "type": "object",
    "properties": {
        "question_text": {"type": "string"},
        "question_type": {"type": "string"},
        "options": {
            "type": "array",
            "items": {"type": "string"}
        }
    },
    "required": ["question_text", "question_type"]
}

def _post_with_retry(self, url, payload, retries=4, timeout=45):
    last_err = None
    for i in range(retries):
        try:
            r = requests.post(url, headers=self.headers, json=payload, timeout=timeout)
            # Nếu server đang quá tải hoặc rate limit => thử lại
            if r.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(f"{r.status_code} {r.text}", response=r)
            r.raise_for_status()
            return r.json()
        except requests.HTTPError as e:
            status = getattr(e.response, "status_code", 0)
            if status in (429, 500, 502, 503, 504) and i < retries - 1:
                # Exponential backoff + jitter (1s, 2s, 4s, ...)
                time.sleep((2 ** i) + random.random())
                continue
            last_err = e
            break
        except requests.RequestException as e:
            last_err = e
            if i < retries - 1:
                time.sleep((2 ** i) + random.random())
                continue
            break
    if last_err:
        raise last_err

def _clean_option_text(s: str) -> str:
    if not s:
        return ""
    s = str(s).strip()
    # dạng: option_text='xxx' display_order=2  ->  xxx
    m = re.search(r"option_text\s*=\s*['\"]([^'\"]+)['\"]", s, flags=re.I)
    if m:
        return m.group(1).strip()
    # dạng: {'option_text': 'xxx', 'display_order': 1} -> khử chuỗi
    m = re.search(r"'option_text'\s*:\s*'([^']+)'", s)
    if m:
        return m.group(1).strip()
    # nếu chỉ là "Lựa chọn A" thì giữ nguyên
    return s

JSON_PATTERN = re.compile(r"\{[\s\S]*\}", re.MULTILINE)
def _try_load_json(maybe_json: str) -> Optional[Dict[str, Any]]:
    """
    Cố gắng parse JSON từ một chuỗi:
    - Thử loads trực tiếp
    - Nếu thất bại, tìm khối {...} lớn nhất trong text rồi parse
    """
    if not isinstance(maybe_json, str):
        return None
    # 1) thử parse trực tiếp
    try:
        return json.loads(maybe_json)
    except Exception:
        pass
    # 2) thử bắt khối JSON { ... }
    m = JSON_PATTERN.search(maybe_json)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None

BACKOFFS = [0.6, 1.2, 2.4, 4.8]  # exponential backoff with jitter

def _safe_request(session: requests.Session, url: str, payload: dict, headers: dict, timeout: int = 30):
    """
    Gọi Gemini với retry/backoff cho các lỗi 429/5xx.
    Trả về response.json() nếu OK, hoặc raise nếu hết retry.
    """
    last_exc = None
    for i, base in enumerate(BACKOFFS):
        try:
            resp = session.post(url, json=payload, headers=headers, timeout=timeout)
            if resp.status_code == 200:
                return resp.json()
            # 429 / 5xx => backoff
            if resp.status_code in (429, 500, 502, 503, 504):
                # ngủ rồi thử lại
                jitter = random.uniform(0, 0.3)
                time.sleep(base + jitter)
                last_exc = requests.HTTPError(f"{resp.status_code} {resp.reason}")
                continue
            # còn lại raise luôn
            resp.raise_for_status()
        except requests.RequestException as e:
            # network lỗi: thử lại nếu còn lượt
            last_exc = e
            jitter = random.uniform(0, 0.3)
            time.sleep(base + jitter)
    # hết retry
    if last_exc:
        raise last_exc
    raise RuntimeError("Unknown request failure")

def _coerce_question_dict(text_or_dict) -> Optional[dict]:
    """
    Chuẩn hoá câu hỏi từ Gemini về dict:
    - Nếu là dict: trả thẳng (chỉ pick các field cần).
    - Nếu là string JSON: json.loads rồi trả dict.
    - Nếu là string thường chứa JSON: strip và cố json.loads.
    - Không valid => None.
    """
    if text_or_dict is None:
        return None

    # Trường hợp content đã là dict với keys chuẩn
    if isinstance(text_or_dict, dict):
        q_text = (text_or_dict.get("question_text") or "").strip()
        q_type = (text_or_dict.get("question_type") or text_or_dict.get("type") or "").strip()
        options = text_or_dict.get("options") or []
        return {
            "question_text": q_text,
            "question_type": q_type or "open_ended",
            "options": options if isinstance(options, list) else []
        }

    # Nếu là string -> cố parse JSON
    if isinstance(text_or_dict, str):
        s = text_or_dict.strip()
        # Gemini hay trả phần text là JSON string của 1 object
        if s.startswith("{") and s.endswith("}"):
            try:
                data = json.loads(s)
                return _coerce_question_dict(data)
            except Exception:
                return None
        # Có thể bọc thêm text khác -> cố tìm JSON object đầu tiên
        first = s.find("{")
        last = s.rfind("}")
        if first != -1 and last != -1 and last > first:
            maybe = s[first:last+1]
            try:
                data = json.loads(maybe)
                return _coerce_question_dict(data)
            except Exception:
                return None
        return None

    # kiểu khác thì bỏ
    return None

class GeminiClient:
    def __init__(self, config: GeminiConfig):
        self.config = config
        self.headers = {
            "Content-Type": "application/json"
        }

    def _coerce_option_list(self, options) -> list[str]:
        """Trả về list[str] sạch; chấp nhận [], list[str], list[dict]."""
        if not options:
            return []
        out = []
        if isinstance(options, list):
            for o in options:
                if isinstance(o, dict):
                    t = (o.get("option_text") or "").strip()
                    if t:
                        out.append(t)
                elif isinstance(o, str):
                    s = o.strip()
                    if s:
                        # cắt noise kiểu `option_text='X'` nếu model lỡ trả
                        m = re.search(r"option_text\s*[:=]\s*['\"]([^'\"]+)['\"]", s, flags=re.I)
                        out.append(m.group(1).strip() if m else s)
        elif isinstance(options, str):
            s = options.strip()
            if s:
                out.append(s)
        return out

    def _is_placeholder_question(self, text: str) -> bool:
        low = (text or "").strip().lower()
        return (not low) or low.startswith("câu hỏi ") or low.startswith("question ") or low in {"placeholder", "sample question"}
    

    def generate_survey(self, prompt: str, context: Optional[Dict[str, Any]] = None):
        try:
            texts = self._call_gemini_api(
                prompt if not context else f"{prompt}\n\nNgữ cảnh: {context}",
                candidate_count=3,
                max_output_tokens=3072,          # tăng lên 3072 để tránh cắt JSON (mỗi câu ~200-300 tokens)
                response_schema=SURVEY_SCHEMA
            )
            if not texts:
                return None

            best = None
            best_score = -1
            for t in texts:
                parsed = self._parse_survey_response(t)
                if not parsed or not getattr(parsed, "questions", None):
                    continue

                # chấm độ “đủ và sạch”: số câu hợp lệ & không placeholder
                ok = 0
                for q in parsed.questions:
                    qt = (getattr(q, "question_text", "") or "").strip().lower()
                    if qt and not qt.startswith("câu hỏi "):
                        ok += 1
                if ok > best_score:
                    best, best_score = parsed, ok

            return best

        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 429:
                # đừng crash, trả None để tầng trên fallback
                return None
            raise


    
    def generate_one_question(
        self,
        title: str = "",
        category: str = "general",
        question_type: Optional[str] = None,
        ai_prompt: str = "",
        previous_question: str = ""
    ) -> Dict[str, Any]:
        try:
            req_type = (question_type or "").strip().lower().replace("-", "_").replace(" ", "_")
            guide = [
                "Bạn là chuyên gia tạo câu hỏi khảo sát.",
                f"Chủ đề: {title or '(không có)'}",
                f"Danh mục: {category or 'general'}",
                (f"Loại câu hỏi yêu cầu: {req_type}" if req_type else ""),
                "Chỉ tạo 1 câu, rõ ràng, không dùng placeholder kiểu 'Câu hỏi 1'.",
                "Trả về JSON: {question_text, question_type, options?}.",
                "Với open_ended/rating/boolean_/date_time/file_upload: options = [].",
                "Với single_choice/multiple_choice/ranking: sinh 3–5 lựa chọn thực tế."
            ]
            
            # ✨ PROMPT ĐẶC BIỆT CHO RANKING: Yêu cầu tối thiểu 5 options
            if req_type == "ranking":
                guide.append("⚠️ QUAN TRỌNG: Loại 'ranking' BẮT BUỘC phải có TỐI THIỂU 5 options (không được dưới 5).")
                guide.append("Ví dụ ranking options: ['Rất quan trọng', 'Quan trọng', 'Bình thường', 'Ít quan trọng', 'Không quan trọng']")
                guide.append("Hoặc ranking theo thứ tự ưu tiên: ['Ưu tiên cao nhất', 'Ưu tiên cao', 'Ưu tiên trung bình', 'Ưu tiên thấp', 'Ưu tiên thấp nhất']")
            
            if previous_question:
                guide.append(f"Không lặp lại/diễn đạt giống câu trước: \"{previous_question}\"")
            if ai_prompt:
                guide.append(ai_prompt.strip())

            minimal_prompt = "\n".join([s for s in guide if s])

            texts = self._call_gemini_api(
                minimal_prompt,
                max_output_tokens=512,
                candidate_count=1,
                response_schema=ONE_QUESTION_SCHEMA
            )
            if not texts:
                return {}

            def _is_placeholder(s: str) -> bool:
                low = (s or "").strip().lower()
                return (not low) or low.startswith("câu hỏi ") or low.startswith("question ")

            for t in texts:
                json_text = self._extract_json_from_text(t)
                if not json_text:
                    continue
                try:
                    data = json.loads(json_text)
                except Exception:
                    continue

                if isinstance(data, dict) and "question_text" in data:
                    item = data
                elif isinstance(data, dict) and "questions" in data:
                    qs = data.get("questions") or []
                    item = qs[0] if qs else {}
                elif isinstance(data, list):
                    item = data[0] if data else {}
                else:
                    item = {}

                q_text = (item.get("question_text") or item.get("text") or item.get("question") or "").strip()
                if _is_placeholder(q_text):
                    continue

                q_type = (item.get("question_type") or item.get("type") or (req_type or "open_ended")).strip().lower().replace("-", "_").replace(" ", "_")
                options = item.get("options") or []
                if q_type in {"open_ended", "rating", "boolean_", "date_time", "file_upload"}:
                    options = []

                return {"question_text": q_text, "question_type": q_type, "options": options}

            return {}

        except Exception as e:
            logger.error("Lỗi khi tạo 1 câu hỏi với Gemini: %s", e)
            return {}


    def _build_survey_prompt(self, user_prompt: str, context: Dict[str, Any] = None) -> str:
        """Xây dựng prompt toàn diện cho Gemini API"""
        
        # Lấy số lượng câu hỏi từ context hoặc mặc định 5
        num_questions = context.get('number_of_questions', 5) if context else 5
        
        # Tạo ví dụ câu hỏi dựa trên số lượng yêu cầu
        example_questions = []
        for i in range(min(num_questions, 2)):  # Tối đa 2 ví dụ
            if i == 0:
                example_questions.append(f'''        {{
            "question_text": "Câu hỏi {i+1}",
            "question_type": "multiple_choice",
            "is_required": true,
            "display_order": {i+1},
            "options": [
                {{"option_text": "Lựa chọn A", "display_order": 1}},
                {{"option_text": "Lựa chọn B", "display_order": 2}}
            ]
        }}''')
            else:
                example_questions.append(f'''        {{
            "question_text": "Câu hỏi {i+1}", 
            "question_type": "open_ended",
            "is_required": false,
            "display_order": {i+1},
            "options": []
        }}''')
        
        questions_example = ",\n".join(example_questions)
        
        base_prompt = f"""Bạn là chuyên gia thiết kế khảo sát. Tạo khảo sát cho: {user_prompt}

QUAN TRỌNG: Chỉ trả về JSON hợp lệ, không có text thêm.
QUAN TRỌNG: Tạo CHÍNH XÁC {num_questions} câu hỏi, không hơn không kém.

{{
    "title": "Tiêu đề khảo sát",
    "description": "Mô tả mục đích khảo sát", 
    "questions": [
{questions_example}
    ]
}}

Tạo CHÍNH XÁC {num_questions} câu hỏi. Dùng multiple_choice, open_ended, rating, boolean_, date_time, file_upload. Với open_ended/rating/boolean_/date_time/file_upload thì options = []."""

        # Thêm context nếu được cung cấp
        if context:
            if context.get('title_hint'):
                base_prompt += f" Tiêu đề khảo sát: '{context['title_hint']}'."
            if context.get('description_hint'):
                base_prompt += f" Mô tả: '{context['description_hint']}'."
            if context.get('category'):
                base_prompt += f" Lĩnh vực: {context['category']}."
            if context.get('target_audience'):
                base_prompt += f" Đối tượng: {context['target_audience']}."
        
        return base_prompt
    
    def _call_gemini_api(
        self,
        prompt: str,
        max_output_tokens: int = 1024,
        candidate_count: int = 1,
        response_schema: Optional[dict] = None,
        model_name: Optional[str] = None,
    ) -> list[str]:
        """
        Gọi Gemini với structured output, retry/backoff cho 429/5xx.
        Trả danh sách text JSON (hoặc inlineData JSON đã decode) từ các candidates.
        """
        model = model_name or self.config.model  # dùng field thống nhất
        url = f"{self.config.base_url}/models/{model}:generateContent?key={self.config.api_key}"

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": getattr(self.config, "temperature", 0.4),
                "maxOutputTokens": max_output_tokens,
                "candidateCount": max(1, min(int(candidate_count), 4)),  # clamp 1..3
                "responseMimeType": "application/json",
            }
        }
        if response_schema:
            payload["generationConfig"]["responseSchema"] = response_schema

        RETRY_CODES = {429, 500, 502, 503, 504}
        backoff = 0.8
        attempts = 0
        last_err = None

        while attempts < 3:
            try:
                r = requests.post(url, headers=self.headers, json=payload, timeout=40)
                if r.status_code in RETRY_CODES:
                    last_err = f"{r.status_code} {r.text[:200]}"
                    attempts += 1
                    time.sleep(backoff + random.uniform(0, 0.3))
                    backoff *= 2
                    continue

                r.raise_for_status()
                data = r.json()

                out: list[str] = []
                for c in (data.get("candidates") or []):
                    parts = ((c.get("content") or {}).get("parts") or [])
                    for p in parts:
                        if isinstance(p, dict) and p.get("text"):
                            out.append(p["text"])
                        elif isinstance(p, dict) and p.get("inlineData"):
                            inline = p["inlineData"]
                            mime = inline.get("mimeType", "")
                            if "json" in mime.lower() and inline.get("data"):
                                try:
                                    decoded = base64.b64decode(inline["data"]).decode("utf-8", "ignore")
                                    if decoded:
                                        out.append(decoded)
                                except Exception:
                                    pass
                return out

            except requests.RequestException as e:
                last_err = str(e)
                attempts += 1
                time.sleep(backoff + random.uniform(0, 0.3))
                backoff *= 2

        # Fallback model chain nếu vẫn fail (đặc biệt 429/503)
        # QUAN TRỌNG: Phải dùng model được truyền vào (model_name) hoặc model mặc định
        current_model = model_name or self.config.model
        
        # Chỉ fallback khi gặp rate limit (429) hoặc server error (503/500)
        if any(code in str(last_err) for code in ["429", "503", "500"]):
            # Tìm vị trí model hiện tại trong fallback chain
            try:
                current_idx = self.config.fallback_models.index(current_model)
            except ValueError:
                # Model hiện tại không có trong chain → bắt đầu từ đầu
                current_idx = -1
            
            # Thử các models còn lại trong chain
            for next_model in self.config.fallback_models[current_idx + 1:]:
                logger.warning(
                    f"⚠️ Model '{current_model}' gặp lỗi {last_err[:100]}. "
                    f"Fallback sang '{next_model}'..."
                )
                try:
                    # RECURSIVE CALL với model mới - sẽ không loop vì current_idx tăng dần
                    result = self._call_gemini_api(
                        prompt,
                        max_output_tokens=max_output_tokens,
                        candidate_count=candidate_count,
                        response_schema=response_schema,
                        model_name=next_model  # Truyền model mới xuống
                    )
                    logger.info(f"✅ Fallback thành công với model '{next_model}'")
                    return result
                except Exception as e:
                    logger.error(f"❌ Fallback '{next_model}' thất bại: {str(e)[:100]}")
                    continue
            
            logger.error(f"💥 Đã thử hết {len(self.config.fallback_models)} models trong fallback chain")

        raise RuntimeError(f"Gemini API unavailable after retries. Last error: {last_err}")



    def _sanitize_questions_payload(self, payload: dict) -> dict:
        """
        Chuẩn hoá dữ liệu từ Gemini trước khi validate bằng Pydantic.
        KHÔNG tự bơm A/B cho MCQ/Single. Chỉ xoá options cho các loại không-option.
        """
        NON_OPTION_TYPES = {"open_ended", "rating", "boolean_", "date_time", "file_upload"}
        questions = payload.get("questions", []) or []

        for q in questions:
            raw = (q.get("question_type") or "").strip().lower().replace("-", "_").replace(" ", "_")
            if raw in ["boolean", "yes_no", "true_false"]:
                qtype = "boolean_"
            elif raw in ["date", "datetime", "time", "time_picker", "date_time"]:
                qtype = "date_time"
            elif raw in ["file", "upload", "attachment", "file_upload"]:
                qtype = "file_upload"
            elif raw in ["single", "singlechoice", "radio"]:
                qtype = "single_choice"
            elif raw in ["mcq", "multiple", "multi_choice", "checkbox"]:
                qtype = "multiple_choice"
            else:
                qtype = raw or "open_ended"
            q["question_type"] = qtype

            if qtype in NON_OPTION_TYPES:
                q["options"] = []
            else:
                # giữ nguyên options do AI trả; chuẩn hoá format nếu cần
                opts = q.get("options") or []
                norm = []
                for i, o in enumerate(opts, start=1):
                    if isinstance(o, dict):
                        t = (o.get("option_text") or o.get("text") or o.get("label") or "").strip()
                    else:
                        t = str(o).strip()
                    if t:
                        norm.append({"option_text": t, "display_order": i})
                q["options"] = norm

            q["is_required"] = bool(q.get("is_required", True))

        payload["questions"] = questions
        return payload

    
    def _parse_survey_response(self, response_text: str) -> Optional[GeneratedSurveyResponse]:
        try:
            json_text = self._extract_json_from_text(response_text)
            if not json_text:
                preview = (response_text or "")[:300].replace("\n", " ")
                logger.warning(f"[gemini] ⚠️ Không tìm thấy JSON block. Preview (300 chars): {preview}")
                # thử sửa JSON bị cắt cụt rồi parse lại
                fixed = self._fix_incomplete_json(response_text or "")
                try:
                    data = json.loads(fixed)
                    logger.info(f"[gemini] ✅ Đã sửa được JSON bị cắt: {len(fixed)} chars")
                except Exception as e:
                    logger.error(f"[gemini] ❌ Fix JSON thất bại: {e}. Raw length: {len(response_text or '')}")
                    raise ValueError("Không tìm thấy JSON trong phản hồi")
            else:
                data = json.loads(json_text)

            normalized_data = self._normalize_survey_data(data)
            normalized_data = self._sanitize_questions_payload(normalized_data)
            if not normalized_data.get("questions"):
                return None

            return GeneratedSurveyResponse(**normalized_data)

        except json.JSONDecodeError as e:
            logger.error(f"Lỗi phân tích JSON: {str(e)}")
            logger.error(f"Văn bản phản hồi: {response_text}")
            return None
        except Exception as e:
            logger.error(f"Lỗi khi phân tích phản hồi khảo sát: {str(e)}")
            return None


    def _extract_json_from_text(self, text: str) -> str | None:
        """
        Bóc JSON từ phản hồi LLM theo kiểu 'chịu lỗi':
        - Ưu tiên khối ```json ... ``` hoặc ``` ... ```
        - Nếu không có, lấy từ dấu '{' đầu tiên đến '}' cuối cùng (cân bằng ngoặc)
        - Nếu JSON bị cắt, thử sửa bằng _fix_incomplete_json()
        """
        if not text:
            return None
        t = text.strip()

        # 1) ```json ... ```
        m = re.search(r"```json\s*(\{[\s\S]+?\})\s*```", t, flags=re.I)
        if m:
            return m.group(1)

        # 2) ``` ... ```
        m = re.search(r"```\s*(\{[\s\S]+?\})\s*```", t, flags=re.I)
        if m:
            return m.group(1)

        # 3) Cắt theo dấu ngoặc nhọn cân bằng
        start = t.find("{")
        end   = t.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = t[start:end+1]

            # Cân bằng ngoặc thô: loại bỏ phần thừa khi bị cắt đuôi do MAX_TOKENS
            open_cnt = candidate.count("{")
            close_cnt = candidate.count("}")
            if close_cnt > open_cnt:
                # có thể thừa }, giữ nguyên
                pass
            elif open_cnt > close_cnt:
                # thiếu }, thử fix
                fixed = self._fix_incomplete_json(candidate)
                try:
                    json.loads(fixed)  # validate
                    return fixed
                except Exception:
                    return None
            return candidate

        return None


    def _fix_incomplete_json(self, json_str: str) -> str:
        """Cố gắng sửa JSON bị cắt bằng cách thêm dấu đóng ngoặc và xoá string chưa đóng"""
        if not json_str:
            return json_str
        
        result = json_str
        
        # Xoá string literals chưa đóng ở cuối (ví dụ: "text": "Đế mỏng gi)
        # Tìm dấu " cuối cùng
        last_quote = result.rfind('"')
        if last_quote != -1:
            # Đếm số dấu " trước đó để xem có lẻ không
            quotes_before = result[:last_quote].count('"')
            if quotes_before % 2 == 0:  # nếu chẵn → dấu " cuối là mở
                # Cắt bỏ string chưa đóng
                result = result[:last_quote].rstrip(',').rstrip()
            
        # Đếm số dấu mở và đóng
        open_braces = result.count('{')
        close_braces = result.count('}')
        open_brackets = result.count('[')
        close_brackets = result.count(']')
        
        # Thêm dấu đóng ngoặc vuông nếu thiếu
        for _ in range(open_brackets - close_brackets):
            result += ']'
            
        # Thêm dấu đóng ngoặc nhọn nếu thiếu
        for _ in range(open_braces - close_braces):
            result += '}'
            
        return result

    def _normalize_survey_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Chuẩn hoá phản hồi Gemini về định dạng mong đợi.
        Hỗ trợ cả 2 dạng:
        - Object: { "title": ..., "description": ..., "questions": [...] }
        - List thuần: [ {text/type/options}, ... ]
        """
        # 1) Lấy danh sách raw questions bất kể data là dict hay list
        if isinstance(data, list):
            questions_raw = data
            title = "Khảo sát"
            description = "Mô tả khảo sát"
        elif isinstance(data, dict):
            title = data.get('title') or data.get('surveyTitle') or data.get('survey_title', 'Khảo sát')
            description = data.get('description') or data.get('surveyDescription') or data.get('survey_description', 'Mô tả khảo sát')
            questions_raw = data.get('questions', []) or data.get('items', []) or data.get('qs', [])
        else:
            # format lạ -> rỗng
            title = "Khảo sát"
            description = "Mô tả khảo sát"
            questions_raw = []

        # 2) Chuẩn hoá từng câu hỏi
        normalized_questions = []
        for i, q in enumerate(questions_raw or []):
            # q có thể là dict hoặc string; ta chỉ nhận dict hợp lệ
            if not isinstance(q, dict):
                continue
            normalized_q = {
                'question_text': q.get('question_text') or q.get('text') or q.get('question') or f'Câu hỏi {i+1}',
                'question_type': self._normalize_question_type(q.get('question_type') or q.get('type') or 'open_ended'),
                'is_required': q.get('is_required', q.get('required', True)),
                'display_order': i + 1,
                'options': self._normalize_options(q.get('options', [])),
            }
            normalized_questions.append(normalized_q)

        return {
            'title': title,
            'description': description,
            'questions': normalized_questions
        }


    def _normalize_question_type(self, qtype: str) -> str:
        qtype = qtype.lower()
        if qtype in ['radio', 'single', 'single_choice']:
            return 'single_choice'
        if qtype in ['multiple_choice','multiple','multi_choice','checkbox','mcq']:
            return 'multiple_choice'
        if qtype in ['text','textarea','open','open_ended']:
            return 'open_ended'
        if qtype in ['rating','scale']:
            return 'rating'
        if qtype in ['boolean','bool','yes_no','true_false']:
            return 'boolean_'
        if qtype in ['date','datetime','date_time','time','time_picker']:
            return 'date_time'
        if qtype in ['file','file_upload','upload','attachment']:
            return 'file_upload'
        return 'open_ended'


    def _normalize_options(self, options):
        out = []
        if not isinstance(options, list):
            return out
        for i, o in enumerate(options, start=1):
            if isinstance(o, dict):
                txt = (o.get("option_text") or "").strip()
            else:
                txt = _clean_option_text(str(o))
            if txt:
                out.append({"option_text": txt, "display_order": i})
        return out


# Hàm factory để tạo Gemini client
def create_gemini_client(api_key: str) -> GeminiClient:
    """Hàm factory để tạo Gemini client với cấu hình mặc định"""
    # Đọc model từ biến môi trường, fallback về gemini-2.5-flash
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    config = GeminiConfig(api_key=api_key, model=model)
    return GeminiClient(config)