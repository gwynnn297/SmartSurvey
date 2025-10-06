# AI Backend Integration Guide - SmartSurvey

## 🚀 **Cách chạy AI Backend 

### **1. Chạy Backend (Spring Boot)**
```bash
cd SmartSurvey/backend

# Set environment variables
$env:DB_USERNAME = "root"
$env:DB_PASSWORD = "123456"
$env:MYSQL_HOST = "localhost"

# Chạy backend
.\gradlew bootRun
```
**→ Backend chạy trên:** `http://localhost:8080`

### **2. Chạy AI Service (Python)**
```bash
cd SmartSurvey/AI/ai-service

# Chạy AI service
python app.py
```
**→ AI Service chạy trên:** `http://localhost:8000`

### **3. Test API**
```bash
# Trigger phân tích sentiment
curl -X POST "http://localhost:8080/ai/sentiment/1"

# Lấy kết quả
curl "http://localhost:8080/ai/sentiment/1"
```

## ⚠️ **Lưu ý:**
- **Cả 2 services phải chạy cùng lúc**
- **MySQL phải đang chạy**
- **Database `smartsurvey` phải tồn tại**

## 🎯 **Kết quả mong đợi:**
```json
{
  "surveyId": 1,
  "positivePercent": 72.50,
  "neutralPercent": 15.30,
  "negativePercent": 12.20,
  "sampleSize": 50
}
```

## 🔧 **Troubleshooting nhanh:**

### **Backend không kết nối AI Service:**
```bash
curl http://localhost:8000/health
```

### **Database errors:**
```sql
USE smartsurvey;
SELECT COUNT(*) FROM ai_sentiment;
```

### **Port conflicts:**
```bash
netstat -ano | findstr :8080  # Backend
netstat -ano | findstr :8000  # AI Service
```

