package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.Category;

import java.util.List;
import java.util.Optional;

/**
 * Repository cho Category entity
 */
@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {
    Optional<Category> findByCategoryName(String categoryName);

    Category findByCategoryNameIgnoreCase(String categoryName);

    List<Category> findByCategoryNameContainingIgnoreCase(String categoryName);

    boolean existsByCategoryName(String categoryName);
}