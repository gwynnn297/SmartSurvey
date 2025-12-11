import os
import random
import pymysql
from faker import Faker
from dotenv import load_dotenv

# Load cấu hình DB từ .env
load_dotenv()

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "123456")
DB_NAME = os.getenv("DB_NAME", "smartsurvey")

# Cấu hình số lượng
NUM_RECORDS = 1000  # Số lượng câu trả lời muốn tạo
TARGET_SURVEY_ID = 1 # Survey ID muốn nhồi dữ liệu vào

fake = Faker('vi_VN') # Dùng tiếng Việt

# === KHO TỪ KHÓA ĐỂ TEST RAG & THỐNG KÊ ===
# Chúng ta trộn template + random text để AI có cái mà phân tích
POS_PATTERNS = [
    "Tôi rất hài lòng về dịch vụ, {reason}.",
    "App chạy rất mượt, {reason}.",
    "Nhân viên nhiệt tình, {reason}.",
    "Giao diện đẹp, dễ sử dụng, {reason}.",
    "Tuyệt vời, sẽ giới thiệu cho bạn bè vì {reason}.",
    "Chất lượng tốt, giá cả hợp lý.",
    "Thích nhất tính năng thanh toán, rất nhanh."
]

NEG_PATTERNS = [
    "Tôi không hài lòng vì {reason}.",
    "App hay bị lỗi, cụ thể là {reason}.",
    "Giá quá đắt so với chất lượng, {reason}.",
    "Thất vọng về thái độ phục vụ, {reason}.",
    "Cần cải thiện tính năng đăng nhập, {reason}.",
    "Load quá chậm, chờ mãi không xong.",
    "Gặp lỗi kỹ thuật liên tục khi sử dụng."
]

NEU_PATTERNS = [
    "Bình thường, không có gì đặc biệt.",
    "Tạm ổn, cần cải thiện thêm {reason}.",
    "Cũng được, nhưng {reason}.",
    "Không có ý kiến gì.",
    "Dùng cũng được."
]

REASONS = [
    "nhân viên hỗ trợ chậm",
    "giao diện hơi rối mắt",
    "xử lý đơn hàng nhanh",
    "màu sắc không đẹp",
    "tính năng tìm kiếm chưa tốt",
    "thao tác thanh toán tiện lợi",
    "đăng nhập bằng Google bị lỗi",
    "app hay bị crash trên Android",
    "không nhận được mã OTP"
]

def get_connection():
    return pymysql.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, database=DB_NAME,
        charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor, autocommit=True
    )

def generate_text():
    # 20% Tiêu cực, 50% Tích cực, 30% Trung lập
    rand = random.random()
    reason = random.choice(REASONS)
    
    if rand < 0.2:
        tmpl = random.choice(NEG_PATTERNS)
    elif rand < 0.7:
        tmpl = random.choice(POS_PATTERNS)
    else:
        tmpl = random.choice(NEU_PATTERNS)
        
    text = tmpl.format(reason=reason)
    # Thêm chút nhiễu ngẫu nhiên từ Faker để không bị trùng lặp hoàn toàn
    if random.random() < 0.3:
        text += " " + fake.sentence()
    return text

def main():
    print(f"--- Bắt đầu tạo {NUM_RECORDS} bản ghi mẫu cho Survey ID {TARGET_SURVEY_ID} ---")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # 1. Kiểm tra xem survey_id có tồn tại không
            cur.execute("SELECT 1 FROM surveys WHERE survey_id = %s", (TARGET_SURVEY_ID,))
            if not cur.fetchone():
                print(f"Lỗi: Survey ID {TARGET_SURVEY_ID} không tồn tại trong bảng 'surveys'. Hãy tạo survey trước.")
                return

            # 2. Tạo Responses (Mỗi answer cần 1 response cha)
            # Chúng ta sẽ insert batch cho nhanh
            print("Đang tạo Responses giả...")
            resp_vals = []
            for _ in range(NUM_RECORDS):
                # respondent_id random hoặc null, created_at random
                created_at = fake.date_time_between(start_date='-1y', end_date='now')
                resp_vals.append((TARGET_SURVEY_ID, created_at))
            
            # Insert Responses
            sql_resp = "INSERT INTO responses (survey_id, submitted_at) VALUES (%s, %s)"
            # Lưu ý: bảng responses của bạn có thể khác, hãy chỉnh lại cột nếu cần
            # Nếu bảng responses của bạn yêu cầu user_id, hãy thêm vào:
            # sql_resp = "INSERT INTO responses (survey_id, user_id, created_at) VALUES (%s, 1, %s)"
            
            cur.executemany(sql_resp, resp_vals)
            
            # Lấy ID của các response vừa tạo (để link sang answers)
            # Cách đơn giản: lấy N response mới nhất của survey này
            cur.execute(
                "SELECT response_id FROM responses WHERE survey_id = %s ORDER BY response_id DESC LIMIT %s",
                (TARGET_SURVEY_ID, NUM_RECORDS)
            )
            response_ids = [r['response_id'] for r in cur.fetchall()]
            
            # 3. Tạo Answers
            print("Đang tạo Answers giả...")
            ans_vals = []
            # Giả sử question_id = 1 là câu hỏi mở (Open-ended)
            target_question_id = 1 
            
            for rid in response_ids:
                text = generate_text()
                # (response_id, question_id, answer_text)
                ans_vals.append((rid, target_question_id, text))
            
            sql_ans = "INSERT INTO answers (response_id, question_id, answer_text) VALUES (%s, %s, %s)"
            cur.executemany(sql_ans, ans_vals)
            
            print(f"✅ Đã chèn thành công {len(ans_vals)} câu trả lời vào Database!")
            
    except Exception as e:
        print(f"❌ Có lỗi xảy ra: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()