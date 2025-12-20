package vn.duytan.c1se09.smartsurvey.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.duytan.c1se09.smartsurvey.domain.User;
import vn.duytan.c1se09.smartsurvey.util.constant.RoleEnum;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository cho User entity
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    List<User> findByRole(RoleEnum role);

    List<User> findByRoleAndIsActive(RoleEnum role, Boolean isActive);

    Optional<User> findByEmailAndIsActive(String email, Boolean isActive);

    long countByRole(RoleEnum role);

    @Query("SELECT u FROM User u WHERE LOWER(u.fullName) LIKE LOWER(CONCAT('%', :fullName, '%'))")
    List<User> findByFullNameContainingIgnoreCase(@Param("fullName") String fullName);

    @Query("SELECT u FROM User u WHERE u.createdAt BETWEEN :startDate AND :endDate")
    List<User> findUsersCreatedBetween(@Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);
    
    // NEW: Query methods cho admin với filtering và pagination
    @Query("""
        SELECT u FROM User u 
        WHERE (:search IS NULL OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :search, '%')) 
               OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')))
        AND (:role IS NULL OR u.role = :role)
        AND (:isActive IS NULL OR u.isActive = :isActive)
        ORDER BY u.createdAt DESC
        """)
    Page<User> findUsersWithFilters(@Param("search") String search,
                                    @Param("role") RoleEnum role,
                                    @Param("isActive") Boolean isActive,
                                    Pageable pageable);
}