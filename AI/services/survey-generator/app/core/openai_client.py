"""
OpenAI API Client cho Tạo Khảo sát
Thay thế Gemini bằng OpenAI GPT models
"""

import json
import logging
import os
import time
import random
import re
from typing import Dict, Any, Optional, List
import requests
from dataclasses import dataclass

logger = logging.getLogger(__name__)

class OpenAIOverloadedError(Exception):
    """Ném khi OpenAI quá tải sau khi đã retry."""
    pass

@dataclass
class OpenAIConfig:
    api_key: str
    base_url: str = "https://api.openai.com/v1"
    model: str = os.getenv("OPENAI_GENERATION_MODEL", "gpt-4o-mini")
    temperature: float = 0.7
    max_tokens: int = 8192
    
    # Fallback chain for OpenAI models
    fallback_models: List[str] = None
    
    def __post_init__(self):
        if self.fallback_models is None:
            # Fallback to cheaper/faster models if rate limited
            self.fallback_models = [
                "gpt-4o-mini",
                "gpt-3.5-turbo"
            ]
    
    @property
    def model_name(self) -> str:
        return self.model

class OpenAIClient:
    def __init__(self, config: OpenAIConfig):
        self.config = config
        self.headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json"
        }
        self._current_model_idx = 0  # For fallback chain
    
    def _is_placeholder_question(self, text: str) -> bool:
        """Kiểm tra câu hỏi có phải placeholder không"""
        low = (text or "").strip().lower()
        return (not low) or low.startswith("câu hỏi ") or low.startswith("question ") or low in {"placeholder", "sample question", "câu hỏi mẫu"}
    
    def _post_with_retry(self, url, payload, retries=4, timeout=45):
        """Gọi OpenAI API với retry logic và exponential backoff"""
        last_err = None
        backoffs = [0.6, 1.2, 2.4, 4.8]  # exponential backoff
        
        for i in range(retries):
            try:
                r = requests.post(url, headers=self.headers, json=payload, timeout=timeout)
                
                # Rate limit or server error
                if r.status_code in (429, 500, 502, 503, 504):
                    if i < retries - 1:
                        jitter = random.uniform(0, 0.3)
                        wait_time = backoffs[min(i, len(backoffs)-1)] + jitter
                        logger.warning(f"⚠️ OpenAI {r.status_code}, retry {i+1}/{retries} sau {wait_time:.1f}s")
                        time.sleep(wait_time)
                        last_err = requests.HTTPError(f"{r.status_code} {r.text}", response=r)
                        continue
                    else:
                        raise requests.HTTPError(f"{r.status_code} {r.text}", response=r)
                
                r.raise_for_status()
                return r.json()
                
            except requests.HTTPError as e:
                status = getattr(e.response, "status_code", 0)
                
                # Try fallback model on rate limit
                if status == 429 and self._current_model_idx < len(self.config.fallback_models) - 1:
                    self._current_model_idx += 1
                    new_model = self.config.fallback_models[self._current_model_idx]
                    logger.warning(f"⚠️ Rate limit! Chuyển sang model: {new_model}")
                    payload["model"] = new_model
                    
                    jitter = random.uniform(0, 0.3)
                    wait_time = backoffs[min(i, len(backoffs)-1)] + jitter
                    time.sleep(wait_time)
                    continue
                
                if i < retries - 1:
                    jitter = random.uniform(0, 0.3)
                    wait_time = backoffs[min(i, len(backoffs)-1)] + jitter
                    time.sleep(wait_time)
                    last_err = e
                else:
                    raise
                    
            except Exception as e:
                logger.error(f"❌ OpenAI request error: {e}")
                if i < retries - 1:
                    jitter = random.uniform(0, 0.3)
                    wait_time = backoffs[min(i, len(backoffs)-1)] + jitter
                    time.sleep(wait_time)
                    last_err = e
                else:
                    raise
                    
        if last_err:
            raise OpenAIOverloadedError(f"OpenAI overloaded after {retries} retries") from last_err
    
    def _call_openai(self, messages: List[Dict], response_format: Optional[Dict] = None, timeout: int = 30):
        """Gọi OpenAI Chat Completions API"""
        url = f"{self.config.base_url}/chat/completions"
        payload = {
            "model": self.config.model,
            "messages": messages,
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens
        }
        
        if response_format:
            payload["response_format"] = response_format
        
        try:
            response = self._post_with_retry(url, payload, timeout=timeout)
            content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            return content
        except Exception as e:
            logger.error(f"❌ OpenAI API call failed: {e}")
            raise
    
    def generate_survey(self, prompt: str, context: Optional[Dict[str, Any]] = None):
        """Tạo khảo sát hoàn chỉnh"""
        system_prompt = """Bạn là chuyên gia thiết kế khảo sát chuyên nghiệp. 
Hãy tạo khảo sát bằng tiếng Việt với các câu hỏi chất lượng cao, rõ ràng và logic.
Trả về JSON theo định dạng:
{
  "title": "Tiêu đề khảo sát",
  "description": "Mô tả ngắn gọn",
  "questions": [
    {
      "question_text": "Câu hỏi",
      "question_type": "open_ended|single_choice|multiple_choice|rating|boolean|ranking|date_time",
      "options": ["Lựa chọn 1", "Lựa chọn 2"]
    }
  ]
}

QUAN TRỌNG: 
- options chỉ có khi question_type là single_choice, multiple_choice, hoặc ranking
- Đối với open_ended, rating, boolean, date_time thì KHÔNG cần options"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]
        
        if context:
            messages.insert(1, {"role": "user", "content": f"Ngữ cảnh: {json.dumps(context, ensure_ascii=False)}"})
        
        response_format = {"type": "json_object"}
        
        try:
            content = self._call_openai(messages, response_format, timeout=45)
            result = json.loads(content)
            
            # Validate và normalize
            if not result.get("questions"):
                raise ValueError("Response không có questions")
            
            for q in result["questions"]:
                if not q.get("question_text"):
                    raise ValueError("Câu hỏi thiếu question_text")
                if not q.get("question_type"):
                    q["question_type"] = "open_ended"
                
                # Đảm bảo options tồn tại cho các loại cần thiết
                qtype = q["question_type"]
                if qtype in ["single_choice", "multiple_choice", "ranking"]:
                    if not q.get("options") or not isinstance(q["options"], list):
                        q["options"] = []
                elif qtype == "boolean":
                    # Boolean type cần có options Đúng/Sai
                    q["options"] = [
                        {"option_text": "Đúng", "display_order": 1},
                        {"option_text": "Sai", "display_order": 2}
                    ]
                elif "options" not in q:
                    q["options"] = []
            
            return result
        except json.JSONDecodeError as e:
            logger.error(f"❌ Invalid JSON from OpenAI: {e}")
            raise
        except Exception as e:
            logger.error(f"❌ generate_survey failed: {e}")
            raise
    
    def generate_one_question(
        self, 
        title: str,
        category: str,
        question_type: str,
        ai_prompt: str = "",
        previous_question: str = ""
    ) -> Dict[str, Any]:
        """Tạo một câu hỏi duy nhất với quality scoring"""
        type_instructions = {
            "open_ended": "Câu hỏi mở, người dùng trả lời tự do. KHÔNG cần options.",
            "single_choice": "Chọn 1 đáp án, CẦN 3-5 options.",
            "multiple_choice": "Chọn nhiều đáp án, CẦN 3-6 options.",
            "rating": "Đánh giá thang điểm 1-5 hoặc 1-10. KHÔNG cần options.",
            "boolean": "Câu hỏi Có/Không hoặc Đúng/Sai. KHÔNG cần options.",
            "boolean_": "Câu hỏi Có/Không hoặc Đúng/Sai. KHÔNG cần options.",
            "ranking": "Xếp hạng ưu tiên, CẦN TỐI THIỂU 5 options (quan trọng!).",
            "date_time": "Chọn ngày/giờ. KHÔNG cần options."
        }
        
        instruction = type_instructions.get(question_type, "Câu hỏi mở")
        needs_options = question_type in ["single_choice", "multiple_choice", "ranking"]
        min_options = 5 if question_type == "ranking" else 3
        
        guide = [
            "Bạn là chuyên gia tạo câu hỏi khảo sát chuyên nghiệp.",
            f"Chủ đề: {title}",
            f"Danh mục: {category}",
            f"Loại câu hỏi: {question_type} - {instruction}",
            "Chỉ tạo 1 câu hỏi, rõ ràng, KHÔNG dùng placeholder kiểu 'Câu hỏi 1', 'Question 1'.",
        ]
        
        # Special handling for ranking
        if question_type == "ranking":
            guide.extend([
                "⚠️ QUAN TRỌNG: Loại 'ranking' BẮT BUỘC phải có TỐI THIỂU 5 options!",
                "Ví dụ: ['Rất quan trọng', 'Quan trọng', 'Bình thường', 'Ít quan trọng', 'Không quan trọng']",
                "Hoặc: ['Ưu tiên cao nhất', 'Ưu tiên cao', 'Ưu tiên trung bình', 'Ưu tiên thấp', 'Ưu tiên thấp nhất']"
            ])
        
        if previous_question:
            guide.append(f"Không lặp lại/diễn đạt giống câu trước: \"{previous_question}\"")
        
        if ai_prompt:
            guide.append(ai_prompt.strip())
        
        system_prompt = "\n".join(guide)
        system_prompt += f"\n\nTrả về JSON:\n{{\n  \"question_text\": \"Câu hỏi rõ ràng\",\n  \"question_type\": \"{question_type}\",\n  \"options\": {json.dumps(['Tùy chọn ' + str(i) for i in range(1, min_options+1)] if needs_options else [])}\n}}"
        
        user_prompt = f"Tạo câu hỏi cho khảo sát: {title}"
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response_format = {"type": "json_object"}
        
        # Try with n=2 to get multiple candidates and pick best
        max_candidates = 2
        
        try:
            url = f"{self.config.base_url}/chat/completions"
            payload = {
                "model": self.config.model,
                "messages": messages,
                "temperature": 0.8,  # Cao hơn để diverse
                "max_tokens": 512,
                "n": max_candidates,  # Lấy nhiều responses
                "response_format": response_format
            }
            
            response = self._post_with_retry(url, payload, timeout=30)
            choices = response.get("choices", [])
            
            if not choices:
                raise ValueError("No choices returned")
            
            # Parse all candidates
            candidates = []
            for choice in choices:
                try:
                    content = choice.get("message", {}).get("content", "")
                    result = json.loads(content)
                    
                    # Validate basic structure
                    if not result.get("question_text"):
                        continue
                    
                    # Skip placeholders
                    if self._is_placeholder_question(result["question_text"]):
                        continue
                    
                    # ⚠️ FIX: Force question_type to match backend enum
                    result["question_type"] = question_type
                    
                    opts = result.get("options", [])
                    if question_type == "boolean":
                        # Boolean type cần có options Đúng/Sai
                        result["options"] = [
                            {"option_text": "Đúng", "display_order": 1},
                            {"option_text": "Sai", "display_order": 2}
                        ]
                    elif not isinstance(opts, list) or len(opts) < 2:
                        # Fallback options
                        result["options"] = [f"Lựa chọn {i}" for i in range(1, min_options+1)]
                    elif question_type == "ranking" and len(opts) < 5:
                        # Ranking cần ít nhất 5 options
                        logger.warning(f"⚠️ Ranking chỉ có {len(opts)} options, cần tối thiểu 5")
                        # Bổ sung thêm
                        while len(opts) < 5:
                            opts.append(f"Lựa chọn {len(opts)+1}")
                        result["options"] = opts
                    elif "options" not in result:
                        result["options"] = []
                    
                    # Score quality
                    score = len(result["question_text"])  # Longer = more detailed
                    if needs_options:
                        score += len(result.get("options", [])) * 10  # Reward more options
                    
                    candidates.append((score, result))
                    
                except Exception as e:
                    logger.debug(f"Failed to parse candidate: {e}")
                    continue
            
            # Pick best candidate
            if candidates:
                candidates.sort(key=lambda x: x[0], reverse=True)
                return candidates[0][1]
            
            # Fallback if all failed
            raise ValueError("All candidates failed validation")
            
        except Exception as e:
            logger.error(f"❌ generate_one_question failed: {e}")
            # Fallback response
            fallback_options = []
            if question_type in ["single_choice", "multiple_choice"]:
                fallback_options = ["Lựa chọn 1", "Lựa chọn 2", "Lựa chọn 3"]
            elif question_type == "ranking":
                fallback_options = ["Rất quan trọng", "Quan trọng", "Bình thường", "Ít quan trọng", "Không quan trọng"]
            
            return {
                "question_text": f"Câu hỏi về {title}",
                "question_type": question_type,
                "options": fallback_options
            }

def create_openai_client(api_key: Optional[str] = None) -> OpenAIClient:
    """Factory function tạo OpenAI client"""
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY")
    
    if not api_key:
        raise ValueError("OPENAI_API_KEY không được cung cấp")
    
    config = OpenAIConfig(api_key=api_key)
    return OpenAIClient(config)
