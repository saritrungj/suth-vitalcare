-- Phase 1: Configurable Scoring (2026-06-26)
-- Idempotency + audit ledger for engine-awarded points.
CREATE TABLE IF NOT EXISTS `score_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `source` enum('daily_mission','assessment','body_comp') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `ref_key` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `points` int NOT NULL DEFAULT 0,
  `detail` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_user_source_ref`(`user_id` ASC, `source` ASC, `ref_key` ASC) USING BTREE,
  INDEX `idx_user`(`user_id` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- Seed default scoring rules (category = 'scoring'); admin-editable via /api/master.
INSERT INTO `master_configs` (`id`, `category`, `key_name`, `display_label`, `metadata`, `sort_order`, `is_active`)
VALUES
  (UUID(), 'scoring', 'daily_mission', 'คะแนนภารกิจรายวัน',
   '{"basePoints":5,"streakTiers":[{"minStreak":3,"bonus":5},{"minStreak":7,"bonus":15},{"minStreak":30,"bonus":50}]}', 1, 1),
  (UUID(), 'scoring', 'assessment', 'คะแนนแบบประเมิน 3อ2ส',
   '{"bands":[{"minScore":0,"maxScore":49,"points":5},{"minScore":50,"maxScore":79,"points":10},{"minScore":80,"maxScore":100,"points":20}],"improvementBonus":15}', 2, 1),
  (UUID(), 'scoring', 'body_composition', 'คะแนนพัฒนาการองค์ประกอบร่างกาย',
   '{"fat_pc":{"pointsPerUnitDecrease":10,"maxPoints":50},"visceral_fat":{"pointsPerUnitDecrease":10,"maxPoints":30},"weight":{"pointsPerUnitDecrease":5,"maxPoints":50},"muscle_mass":{"pointsPerUnitIncrease":10,"maxPoints":50}}', 3, 1)
ON DUPLICATE KEY UPDATE `metadata` = VALUES(`metadata`), `display_label` = VALUES(`display_label`);
