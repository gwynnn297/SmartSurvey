"""
Gemini API Client cho Tạo Khảo sát
Xử lý giao tiếp với Google Gemini API để tạo khảo sát thông minh
"""

import json
import logging
from typing import Dict, Any, Optional, List
import requests
from dataclasses import dataclass
from ..models.survey_schemas import GeneratedSurveyResponse

logger = logging.getLogger(__name__)

@dataclass
class GeminiConfig:
    api_key: str
    base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    model: str = "gemini-2.5-flash"  # Hoặc "gemini-2.5-pro" cho chất lượng cao hơn
    temperature: float = 0.7
    max_tokens: int = 8192

class GeminiClient:
    def __init__(self, config: GeminiConfig):
        self.config = config
        self.headers = {
            "Content-Type": "application/json"
        }
    
    def generate_survey(self, prompt: str, context: Dict[str, Any] = None) -> Optional[GeneratedSurveyResponse]:
        """
        Tạo khảo sát sử dụng Gemini API
        
        Args:
            prompt: Prompt đầu vào từ người dùng để tạo khảo sát
            context: Context bổ sung (danh mục, đối tượng mục tiêu, v.v.)
            
        Returns:
            Đối tượng GeneratedSurveyResponse hoặc None nếu thất bại
        """
        try:
            # Xây dựng prompt được nâng cao với context
            enhanced_prompt = self._build_survey_prompt(prompt, context)
            
            # Gọi Gemini API
            response = self._call_gemini_api(enhanced_prompt)
            
            if response:
                # Phân tích và kiểm tra phản hồi
                return self._parse_survey_response(response)
            
            return None
            
        except Exception as e:
            logger.error(f"Lỗi khi tạo khảo sát với Gemini: {str(e)}")
            return None
    
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

Tạo CHÍNH XÁC {num_questions} câu hỏi. Dùng multiple_choice, open_ended, rating, boolean_. Với open_ended/rating/boolean_ thì options = []."""

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
    
    def _call_gemini_api(self, prompt: str) -> Optional[str]:
        """Thực hiện gọi API đến Gemini"""
        try:
            url = f"{self.config.base_url}/models/{self.config.model}:generateContent"
            
            payload = {
                "contents": [{
                    "parts": [{
                        "text": prompt
                    }]
                }],
                "generationConfig": {
                    "temperature": self.config.temperature,
                    "maxOutputTokens": self.config.max_tokens,
                    "candidateCount": 1
                }
            }
            
            response = requests.post(
                f"{url}?key={self.config.api_key}",
                headers=self.headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                if 'candidates' in result and len(result['candidates']) > 0:
                    content = result['candidates'][0]['content']['parts'][0]['text']
                    return content.strip()
            else:
                logger.error(f"Lỗi Gemini API: {response.status_code} - {response.text}")
                
            return None
            
        except Exception as e:
            logger.error(f"Lỗi khi gọi Gemini API: {str(e)}")
            return None
    
    def _parse_survey_response(self, response_text: str) -> Optional[GeneratedSurveyResponse]:
        """Phân tích và kiểm tra phản hồi từ Gemini API"""
        try:
            # Trích xuất JSON từ văn bản phản hồi
            json_text = self._extract_json_from_text(response_text)
            if not json_text:
                raise ValueError("Không tìm thấy JSON trong phản hồi")
            
            # Phân tích JSON
            data = json.loads(json_text)
            
            # Chuyển đổi định dạng Gemini sang định dạng của chúng ta nếu cần
            normalized_data = self._normalize_survey_data(data)
            
            return GeneratedSurveyResponse(**normalized_data)
            
        except json.JSONDecodeError as e:
            logger.error(f"Lỗi phân tích JSON: {str(e)}")
            logger.error(f"Văn bản phản hồi: {response_text}")
            return None
        except Exception as e:
            logger.error(f"Lỗi khi phân tích phản hồi khảo sát: {str(e)}")
            return None

    def _extract_json_from_text(self, text: str) -> Optional[str]:
        """Trích xuất JSON từ văn bản có thể chứa markdown hoặc nội dung khác"""
        text = text.strip()
        
        # Thử tìm JSON trong markdown code blocks
        import re
        json_pattern = r'```(?:json)?\s*(\{.*?\})\s*```'
        match = re.search(json_pattern, text, re.DOTALL)
        if match:
            json_candidate = match.group(1)
            return self._fix_incomplete_json(json_candidate)
        
        # Thử tìm JSON độc lập
        if text.startswith('{') and text.endswith('}'):
            return self._fix_incomplete_json(text)
            
        # Thử tìm JSON ở đâu đó trong văn bản
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1 and end > start:
            json_candidate = text[start:end+1]
            return self._fix_incomplete_json(json_candidate)
            
        return None

    def _fix_incomplete_json(self, json_str: str) -> str:
        """Cố gắng sửa JSON bị cắt bằng cách thêm dấu đóng ngoặc"""
        if not json_str:
            return json_str
            
        # Đếm số dấu mở và đóng
        open_braces = json_str.count('{')
        close_braces = json_str.count('}')
        open_brackets = json_str.count('[')
        close_brackets = json_str.count(']')
        
        # Thêm dấu đóng nếu thiếu
        result = json_str
        
        # Thêm dấu đóng ngoặc vuông nếu thiếu
        for _ in range(open_brackets - close_brackets):
            result += ']'
            
        # Thêm dấu đóng ngoặc nhọn nếu thiếu
        for _ in range(open_braces - close_braces):
            result += '}'
            
        return result

    def _normalize_survey_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Chuẩn hóa phản hồi Gemini về định dạng mong đợi của chúng ta"""
        # Xử lý các tên trường có thể khác nhau
        title = data.get('title') or data.get('surveyTitle') or data.get('survey_title', 'Khảo sát')
        description = data.get('description') or data.get('surveyDescription') or data.get('survey_description', 'Mô tả khảo sát')
        
        questions = data.get('questions', [])
        normalized_questions = []
        
        for i, q in enumerate(questions):
            normalized_q = {
                'question_text': q.get('text') or q.get('question_text') or q.get('question', f'Câu hỏi {i+1}'),
                'question_type': self._normalize_question_type(q.get('type') or q.get('question_type', 'TEXT')),
                'is_required': q.get('required', q.get('is_required', True)),
                'display_order': i + 1,
                'options': self._normalize_options(q.get('options', []))
            }
            normalized_questions.append(normalized_q)
        
        return {
            'title': title,
            'description': description,
            'questions': normalized_questions
        }

    def _normalize_question_type(self, qtype: str) -> str:
        """Chuẩn hóa loại câu hỏi theo các giá trị mong đợi của database"""
        qtype = qtype.lower()
        if qtype in ['radio', 'single_choice', 'single', 'multiple_choice', 'multiple', 'checkbox']:
            return 'multiple_choice'  # Tất cả đều mapping về multiple_choice
        elif qtype in ['text', 'textarea', 'open', 'open_ended']:
            return 'open_ended'
        elif qtype in ['rating', 'scale']:
            return 'rating'
        elif qtype in ['boolean', 'bool', 'yes_no', 'true_false']:
            return 'boolean_'
        else:
            return 'open_ended'  # Default về open_ended

    def _normalize_options(self, options: List[Dict]) -> List[Dict]:
        """Chuẩn hóa các lựa chọn theo định dạng mong đợi của chúng ta"""
        normalized = []
        for i, opt in enumerate(options):
            normalized_opt = {
                'option_text': opt.get('label') or opt.get('option_text') or opt.get('text', f'Lựa chọn {i+1}'),
                'display_order': i + 1
            }
            normalized.append(normalized_opt)
        return normalized

# Hàm factory để tạo Gemini client
def create_gemini_client(api_key: str) -> GeminiClient:
    """Hàm factory để tạo Gemini client với cấu hình mặc định"""
    config = GeminiConfig(api_key=api_key)
    return GeminiClient(config)