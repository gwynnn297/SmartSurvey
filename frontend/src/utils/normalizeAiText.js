/**
 * Hàm normalize text từ AI để làm sạch các ký tự markdown và ký tự thừa
 * @param {string} text - Text cần normalize
 * @returns {string} - Text đã được làm sạch
 */
export const normalizeAiText = (text) => {
    if (!text || typeof text !== 'string') {
        return text || '';
    }

    let normalized = text;

    // Xóa các label category không cần thiết ở đầu dòng
    // Sắp xếp từ dài đến ngắn để tránh xóa nhầm
    const categoryLabels = [
        'Điểm không hài lòng',
        'Điểm tích cực',
        'Điểm tiêu cực',
        'Đề xuất cải tiến',
        'Đề xuất',
        'Tích cực',
        'Tiêu cực',
        'Nhận định',
        'Kết luận',
        'Tóm tắt',
        'Điểm', // Đặt cuối cùng vì ngắn nhất
    ];

    // Xóa các dòng chỉ có label không có nội dung (như "•Điểm" đứng một mình)
    categoryLabels.forEach(label => {
        // Pattern cho dòng chỉ có label (có thể có dấu : ở cuối, không có nội dung sau)
        const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const emptyLinePattern = new RegExp(`^[\\s]*[•*#\\-]\\s*${escapedLabel}\\s*[:]?\\s*$`, 'gmi');
        normalized = normalized.replace(emptyLinePattern, '');
    });

    // Xóa các label category ở đầu dòng nhưng giữ lại nội dung
    // Xử lý cả trường hợp có và không có dấu :
    categoryLabels.forEach(label => {
        const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Pattern cho label có dấu : (giữ lại nội dung sau dấu :)
        const withColonPattern = new RegExp(`^[\\s]*[•*#\\-]\\s*${escapedLabel}\\s*[:]\\s*`, 'gmi');
        normalized = normalized.replace(withColonPattern, '');

        // Pattern cho label không có dấu : nhưng có nội dung sau
        // Chỉ xóa nếu label đứng ở đầu dòng và có khoảng trắng + chữ cái sau
        const withoutColonPattern = new RegExp(`^[\\s]*[•*#\\-]\\s*${escapedLabel}\\s+(?=[A-ZĐa-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ])`, 'gmi');
        normalized = normalized.replace(withoutColonPattern, '');
    });

    // Xóa các ký tự markdown và ký tự thừa ở đầu dòng
    // Xử lý các pattern như: •* **, •**, **, •*, •, #, -, số thứ tự
    normalized = normalized.replace(/^[\s]*[•]\s*\*{0,2}\s*\*{0,2}\s*/gm, ''); // Xóa •* **, •**, •* ở đầu dòng
    normalized = normalized.replace(/^[\s]*\*{1,3}\s*/gm, ''); // Xóa *, **, *** ở đầu dòng
    normalized = normalized.replace(/^[\s]*[•#\-]\s*/gm, ''); // Xóa •, #, - ở đầu dòng
    normalized = normalized.replace(/^\d+[\.\)]\s*/gm, ''); // Xóa số thứ tự (1., 2.), (1), (2)

    // Xóa các ký tự markdown trong toàn bộ text (nhưng giữ lại nội dung)
    normalized = normalized.replace(/\*\*/g, ''); // Xóa **
    normalized = normalized.replace(/\*/g, ''); // Xóa * (sau khi đã xóa **)
    normalized = normalized.replace(/^#{1,6}\s+/gm, ''); // Xóa heading markdown (#, ##, ###, etc.)

    // Xóa các ký tự thừa ở cuối dòng
    normalized = normalized.replace(/:\s*\*{0,2}\s*$/gm, ''); // Xóa :** hoặc :* ở cuối dòng
    normalized = normalized.replace(/\s*•\s*$/gm, ''); // Xóa • ở cuối dòng
    normalized = normalized.replace(/\s*:\s*$/gm, ''); // Xóa : ở cuối dòng (nếu còn sót)

    // Làm sạch khoảng trắng thừa (nhưng giữ lại xuống dòng)
    normalized = normalized.replace(/[ \t]+/g, ' '); // Thay nhiều khoảng trắng/tab bằng một khoảng
    normalized = normalized.replace(/\n\s*\n\s*\n/g, '\n\n'); // Giảm nhiều dòng trống xuống còn 2
    normalized = normalized.replace(/^\s+/gm, ''); // Xóa khoảng trắng đầu dòng
    normalized = normalized.replace(/\s+$/gm, ''); // Xóa khoảng trắng cuối dòng
    normalized = normalized.trim(); // Xóa khoảng trắng đầu và cuối toàn bộ text

    // Xóa các ký tự đặc biệt thừa khác
    normalized = normalized.replace(/^[\s\-_=]+\s*/gm, ''); // Xóa các ký tự phân cách ở đầu dòng
    normalized = normalized.replace(/\s*[\-_=]+\s*$/gm, ''); // Xóa các ký tự phân cách ở cuối dòng

    // Xóa các dòng chỉ có label đơn giản không có nội dung (như "Điểm" sau khi đã xóa markdown)
    const simpleLabels = ['Điểm', 'Đề xuất', 'Tích cực', 'Tiêu cực', 'Nhận định', 'Kết luận', 'Tóm tắt'];
    const lines = normalized.split('\n');
    const filteredLines = lines.filter(line => {
        const trimmed = line.trim();
        // Xóa dòng trống
        if (trimmed.length === 0) {
            return false;
        }
        // Xóa dòng chỉ có label đơn giản (không có nội dung thực sự)
        // Kiểm tra xem dòng có phải chỉ là một label đơn giản không
        const isOnlyLabel = simpleLabels.some(label => {
            // Kiểm tra xem dòng có phải chỉ là label (có thể có dấu : ở cuối)
            const labelPattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:]?\\s*$`, 'i');
            return labelPattern.test(trimmed);
        });
        return !isOnlyLabel;
    });
    normalized = filteredLines.join('\n');

    // Xóa các dòng trống thừa sau khi filter
    normalized = normalized.replace(/\n\s*\n\s*\n/g, '\n\n');
    normalized = normalized.trim();

    return normalized;
};

/**
 * Hàm merge các items liên tiếp không có label với item trước đó
 * @param {string[]} items - Mảng các text items
 * @returns {string[]} - Mảng các text đã được merge
 */
const mergeContinuationItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        return items;
    }

    const merged = [];
    // Các từ khóa bắt đầu câu mới (không merge) - ưu tiên kiểm tra trước
    const newSentenceKeywords = [
        /^(một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|người|ngược lại|tuy nhiên|nhưng|mặt khác|đề xuất|kết luận|tóm lại|tổng kết)/i
    ];

    // Các pattern để nhận biết dòng là phần tiếp theo
    const continuationPatterns = [
        /^(nhấn mạnh|đồng thời|ngoài ra|bên cạnh đó|hơn nữa|thêm vào đó|đặc biệt|quan trọng là|đáng chú ý|nổi bật|và|với|vì|do|từ|theo|về|cho|trong|trên|dưới|sau|trước|khi|nếu|mà|của|để|được|bị|sẽ|đã|đang)/i,
        /^[a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/ // Bắt đầu bằng chữ thường
    ];

    for (let i = 0; i < items.length; i++) {
        const current = items[i]?.trim();
        if (!current || current.length === 0) {
            continue;
        }

        // Kiểm tra xem có phải là câu mới không (bắt đầu bằng từ khóa đặc biệt)
        const isNewSentence = newSentenceKeywords.some(pattern => pattern.test(current));

        // Kiểm tra xem item hiện tại có phải là phần tiếp theo không
        const isContinuation = !isNewSentence && continuationPatterns.some(pattern => pattern.test(current));

        if (isContinuation && merged.length > 0) {
            // Gộp với item trước đó
            const lastIndex = merged.length - 1;
            merged[lastIndex] = merged[lastIndex] + ' ' + current;
        } else {
            // Thêm item mới
            merged.push(current);
        }
    }

    return merged;
};

/**
 * Hàm normalize một mảng các text items
 * @param {string[]} items - Mảng các text cần normalize
 * @returns {string[]} - Mảng các text đã được làm sạch
 */
export const normalizeAiTextArray = (items) => {
    if (!Array.isArray(items)) {
        return [];
    }
    const simpleLabels = ['Điểm', 'Đề xuất', 'Tích cực', 'Tiêu cực', 'Nhận định', 'Kết luận', 'Tóm tắt'];

    const normalized = items
        .map(item => normalizeAiText(item))
        .filter(item => {
            const trimmed = item && item.trim();
            // Xóa items trống
            if (!trimmed || trimmed.length === 0) {
                return false;
            }
            // Xóa items chỉ có label đơn giản (không có nội dung thực sự)
            const isOnlyLabel = simpleLabels.some(label => {
                const labelPattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:]?\\s*$`, 'i');
                return labelPattern.test(trimmed);
            });
            return !isOnlyLabel;
        });

    // Merge các items liên tiếp không có label
    return mergeContinuationItems(normalized);
};

export default normalizeAiText;

