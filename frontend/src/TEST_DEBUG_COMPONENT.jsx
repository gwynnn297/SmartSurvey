/* 
 * 🧪 Test Component - Để verify Question Type Priorities
 * Paste component này vào CreateAI.jsx ngay trước return để debug
 */

// Thêm vào trước return của component CreateAI
useEffect(() => {
    console.log("🔍 [DEBUG] Current form state:");
    console.log("   - question_type_priorities:", form.question_type_priorities);
    console.log("   - priorities length:", form.question_type_priorities?.length);
    console.log("   - priorities is array:", Array.isArray(form.question_type_priorities));
}, [form.question_type_priorities]);

// Hoặc thêm debug button vào UI (bên cạnh nút "Tạo gợi ý bằng AI")
{/* Debug Button - Xóa sau khi fix */}
<button 
    type="button"
    style={{
        padding: '10px 20px',
        background: '#10b981',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        marginLeft: '10px'
    }}
    onClick={() => {
        console.log("=== DEBUG INFO ===");
        console.log("Form state:", form);
        console.log("Priorities:", form.question_type_priorities);
        console.log("Selected count:", form.question_type_priorities.length);
        alert(`Đã chọn ${form.question_type_priorities.length} loại: ${form.question_type_priorities.join(', ')}`);
    }}
>
    🔍 Debug Priorities
</button>
