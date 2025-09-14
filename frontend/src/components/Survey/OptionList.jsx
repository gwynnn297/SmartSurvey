import React from 'react';
import './OptionList.css';

const OptionList = ({ options = [], onChangeOptions }) => {
    const addOption = () => {
        const newOptions = [...options, { option_text: '' }];
        onChangeOptions(newOptions);
    };

    const updateOption = (index, text) => {
        const newOptions = [...options];
        newOptions[index].option_text = text;
        onChangeOptions(newOptions);
    };

    const removeOption = (index) => {
        if (options.length > 1) {
            const newOptions = options.filter((_, i) => i !== index);
            onChangeOptions(newOptions);
        }
    };

    return (
        <div className="options-container">
            <div className="options-label">
                Các lựa chọn:
            </div>

            <div className="options-list">
                {options.map((option, index) => (
                    <div key={index} className="option-item fade-in">
                        <div className="option-number">
                            {index + 1}
                        </div>
                        <input
                            type="text"
                            value={option.option_text}
                            onChange={(e) => updateOption(index, e.target.value)}
                            placeholder={`Lựa chọn ${index + 1}`}
                            className="option-input"
                        />
                        <button
                            type="button"
                            onClick={() => removeOption(index)}
                            disabled={options.length <= 1}
                            className="remove-option-btn"
                            title={options.length <= 1 ? "Phải có ít nhất 1 lựa chọn" : "Xóa lựa chọn"}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={addOption}
                className="add-option-btn"
            >
                Thêm lựa chọn
            </button>
        </div>
    );
};

export default OptionList;
