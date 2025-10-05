package vn.duytan.c1se09.smartsurvey.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.duytan.c1se09.smartsurvey.domain.Category;
import vn.duytan.c1se09.smartsurvey.util.error.IdInvalidException;
import vn.duytan.c1se09.smartsurvey.repository.CategoryRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {
    private final CategoryRepository categoryRepository;

    public List<Category> getAllCategories() {
        return categoryRepository.findAll();
    }

    /**
     * Tìm category theo ID (dùng cho AI survey generation)
     */
    public Category findCategoryById(Long id) {
        return categoryRepository.findById(id).orElse(null);
    }

    @Transactional
    public Category createCategory(String name) throws IdInvalidException {
        if (name == null || name.isEmpty()) {
            throw new IdInvalidException("Tên danh mục không được để trống");
        }
        if (categoryRepository.existsByCategoryName(name)) {
            throw new IdInvalidException("Tên danh mục đã tồn tại");
        }
        Category category = new Category();
        category.setCategoryName(name);
        return categoryRepository.save(category);
    }

    @Transactional
    public Category updateCategory(Long id, String name) throws IdInvalidException {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy danh mục"));
        if (name == null || name.isEmpty()) {
            throw new IdInvalidException("Tên danh mục không được để trống");
        }
        category.setCategoryName(name);
        return categoryRepository.save(category);
    }

    @Transactional
    public void deleteCategory(Long id) throws IdInvalidException {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IdInvalidException("Không tìm thấy danh mục"));
        categoryRepository.delete(category);
    }
}
