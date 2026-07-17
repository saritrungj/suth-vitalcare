/*
 Navicat Premium Dump SQL

 Source Server         : Docker MySQL 8.4
 Source Server Type    : MySQL
 Source Server Version : 80408 (8.4.8)
 Source Host           : localhost:3308
 Source Schema         : vitalcare

 Target Server Type    : MySQL
 Target Server Version : 80408 (8.4.8)
 File Encoding         : 65001

 Date: 25/06/2026 13:25:08
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for activity_requests
-- ----------------------------
DROP TABLE IF EXISTS `activity_requests`;
CREATE TABLE `activity_requests`  (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` int NULL DEFAULT NULL,
  `team_id` int NULL DEFAULT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'pending',
  `admin_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `user_id`(`user_id` ASC) USING BTREE,
  CONSTRAINT `activity_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of activity_requests
-- ----------------------------

-- ----------------------------
-- Table structure for activity_team_voters
-- ----------------------------
DROP TABLE IF EXISTS `activity_team_voters`;
CREATE TABLE `activity_team_voters`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `vote_id` int NOT NULL,
  `user_id` int NOT NULL,
  `is_agree` tinyint(1) NOT NULL,
  `voted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `vote_id`(`vote_id` ASC, `user_id` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of activity_team_voters
-- ----------------------------

-- ----------------------------
-- Table structure for activity_team_votes
-- ----------------------------
DROP TABLE IF EXISTS `activity_team_votes`;
CREATE TABLE `activity_team_votes`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `team_id` int NOT NULL,
  `event_id` int NOT NULL,
  `status` enum('voting','approved','rejected','host_override') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'voting',
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of activity_team_votes
-- ----------------------------

-- ----------------------------
-- Table structure for assessment_answers
-- ----------------------------
DROP TABLE IF EXISTS `assessment_answers`;
CREATE TABLE `assessment_answers`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NULL DEFAULT NULL,
  `health_assessment_id` int NULL DEFAULT NULL,
  `question_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'เก็บข้อความคำถามเพื่อดูประวัติย้อนหลังได้',
  `answer_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'ระบุข้อความคำตอบที่เลือก',
  `score` int NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `submission_id`(`submission_id` ASC) USING BTREE,
  INDEX `fk_health_assessment`(`health_assessment_id` ASC) USING BTREE,
  CONSTRAINT `assessment_answers_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `assessment_submissions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_health_assessment` FOREIGN KEY (`health_assessment_id`) REFERENCES `health_assessments` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of assessment_answers
-- ----------------------------

-- ----------------------------
-- Table structure for assessment_submissions
-- ----------------------------
DROP TABLE IF EXISTS `assessment_submissions`;
CREATE TABLE `assessment_submissions`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `user_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `test_type` enum('pre_test','post_test') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `total_score` int NULL DEFAULT 0,
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `event_id`(`event_id` ASC) USING BTREE,
  INDEX `user_id`(`user_id` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of assessment_submissions
-- ----------------------------

-- ----------------------------
-- Table structure for audit_logs
-- ----------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `action` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `target_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `target_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_user_action`(`user_id` ASC, `action` ASC) USING BTREE,
  INDEX `idx_created_at`(`created_at` ASC) USING BTREE,
  CONSTRAINT `audit_logs_chk_1` CHECK (json_valid(`metadata`))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of audit_logs
-- ----------------------------

-- ----------------------------
-- Table structure for banners
-- ----------------------------
DROP TABLE IF EXISTS `banners`;
CREATE TABLE `banners`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `subtitle` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `image_url` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `link_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `link_type` enum('activity','url','none') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'none',
  `link_activity_id` int NULL DEFAULT NULL,
  `sort_order` int NULL DEFAULT 0,
  `is_active` tinyint(1) NULL DEFAULT 1,
  `start_date` date NULL DEFAULT NULL,
  `end_date` date NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `positions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `link_activity_id`(`link_activity_id` ASC) USING BTREE,
  CONSTRAINT `banners_ibfk_1` FOREIGN KEY (`link_activity_id`) REFERENCES `events` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `banners_chk_1` CHECK (json_valid(`positions`))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of banners
-- ----------------------------

-- ----------------------------
-- Table structure for bonus_points
-- ----------------------------
DROP TABLE IF EXISTS `bonus_points`;
CREATE TABLE `bonus_points`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `user_id` int NOT NULL,
  `points` int NOT NULL,
  `reason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `given_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_event_user`(`event_id` ASC, `user_id` ASC) USING BTREE,
  INDEX `idx_event`(`event_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of bonus_points
-- ----------------------------

-- ----------------------------
-- Table structure for certificate_templates
-- ----------------------------
DROP TABLE IF EXISTS `certificate_templates`;
CREATE TABLE `certificate_templates`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'เกียรติบัตร',
  `background_url` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `canvas_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT 'Fabric.js JSON ทั้ง canvas',
  `width` int NULL DEFAULT 1754 COMMENT 'ความกว้าง pixels (A4 landscape 150dpi)',
  `height` int NULL DEFAULT 1240 COMMENT 'ความสูง pixels',
  `issue_mode` enum('goal_complete','event_end','manual','immediately') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'event_end',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `event_id`(`event_id` ASC) USING BTREE,
  CONSTRAINT `certificate_templates_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of certificate_templates
-- ----------------------------

-- ----------------------------
-- Table structure for event_favorites
-- ----------------------------
DROP TABLE IF EXISTS `event_favorites`;
CREATE TABLE `event_favorites`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `event_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `user_event`(`user_id` ASC, `event_id` ASC) USING BTREE,
  INDEX `event_id`(`event_id` ASC) USING BTREE,
  CONSTRAINT `event_favorites_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `event_favorites_ibfk_2` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of event_favorites
-- ----------------------------

-- ----------------------------
-- Table structure for event_leaderboards
-- ----------------------------
DROP TABLE IF EXISTS `event_leaderboards`;
CREATE TABLE `event_leaderboards`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NULL DEFAULT NULL,
  `user_id` int NULL DEFAULT NULL,
  `rank` int NULL DEFAULT NULL,
  `score` decimal(10, 2) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `event_id`(`event_id` ASC) USING BTREE,
  INDEX `user_id`(`user_id` ASC) USING BTREE,
  CONSTRAINT `event_leaderboards_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `event_leaderboards_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of event_leaderboards
-- ----------------------------

-- ----------------------------
-- Table structure for events
-- ----------------------------
DROP TABLE IF EXISTS `events`;
CREATE TABLE `events`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `poster` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `detail` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `start_date` date NULL DEFAULT NULL,
  `end_date` date NULL DEFAULT NULL,
  `registration_start_date` date NULL DEFAULT NULL,
  `registration_end_date` date NULL DEFAULT NULL,
  `is_continuous_registration` tinyint(1) NULL DEFAULT 0,
  `is_continuous_event` tinyint(1) NULL DEFAULT 0,
  `is_unlimited_max_slots` tinyint(1) NULL DEFAULT 0,
  `start_time` time NULL DEFAULT NULL,
  `end_time` time NULL DEFAULT NULL,
  `max_slots` int NULL DEFAULT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'กิจกรรม',
  `activity_mode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'event',
  `leaderboard_enabled` tinyint(1) NULL DEFAULT 0,
  `team_mode` tinyint(1) NULL DEFAULT 0,
  `location_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `organizer` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `rules_regulations` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `inclusions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `event_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `visibility` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `health_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'open',
  `publish_start_date` date NULL DEFAULT NULL,
  `created_by` int NULL DEFAULT NULL,
  `team_id` int NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `goal_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `certificate_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `assessment_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `auto_join_team` tinyint(1) NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `created_by`(`created_by` ASC) USING BTREE,
  INDEX `idx_event_search`(`start_date` ASC, `end_date` ASC, `status` ASC) USING BTREE,
  CONSTRAINT `events_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `events_chk_1` CHECK (json_valid(`visibility`)),
  CONSTRAINT `events_chk_2` CHECK (json_valid(`health_config`)),
  CONSTRAINT `events_chk_3` CHECK (json_valid(`goal_config`)),
  CONSTRAINT `events_chk_4` CHECK (json_valid(`certificate_config`))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of events
-- ----------------------------

-- ----------------------------
-- Table structure for health_assessments
-- ----------------------------
DROP TABLE IF EXISTS `health_assessments`;
CREATE TABLE `health_assessments`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `total_score` int NULL DEFAULT NULL,
  `overall_level` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `admin_comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `commented_at` timestamp NULL DEFAULT NULL,
  `commented_by` int NULL DEFAULT NULL,
  `summary_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `user_id`(`user_id` ASC) USING BTREE,
  CONSTRAINT `health_assessments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `health_assessments_chk_1` CHECK (json_valid(`summary_json`))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of health_assessments
-- ----------------------------

-- ----------------------------
-- Table structure for master_configs
-- ----------------------------
DROP TABLE IF EXISTS `master_configs`;
CREATE TABLE `master_configs`  (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `key_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `display_label` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `sort_order` int NULL DEFAULT 0,
  `is_active` tinyint(1) NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `category`(`category` ASC, `key_name` ASC) USING BTREE,
  CONSTRAINT `master_configs_chk_1` CHECK (json_valid(`metadata`))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of master_configs
-- ----------------------------

-- ----------------------------
-- Table structure for mission_submissions
-- ----------------------------
DROP TABLE IF EXISTS `mission_submissions`;
CREATE TABLE `mission_submissions`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `mission_id` int NOT NULL,
  `user_id` int NOT NULL,
  `submission_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `value` decimal(10, 2) NULL DEFAULT NULL,
  `image_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `mission_id`(`mission_id` ASC) USING BTREE,
  INDEX `user_id`(`user_id` ASC) USING BTREE,
  CONSTRAINT `mission_submissions_ibfk_1` FOREIGN KEY (`mission_id`) REFERENCES `activity_missions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `mission_submissions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of mission_submissions
-- ----------------------------

-- ----------------------------
-- Table structure for registrations
-- ----------------------------
DROP TABLE IF EXISTS `registrations`;
CREATE TABLE `registrations`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NULL DEFAULT NULL,
  `event_id` int NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `user_id`(`user_id` ASC, `event_id` ASC) USING BTREE,
  INDEX `event_id`(`event_id` ASC) USING BTREE,
  CONSTRAINT `registrations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `registrations_ibfk_2` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of registrations
-- ----------------------------

-- ----------------------------
-- Table structure for submissions
-- ----------------------------
DROP TABLE IF EXISTS `submissions`;
CREATE TABLE `submissions`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NULL DEFAULT NULL,
  `task_id` int NULL DEFAULT NULL,
  `img_url` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `value` decimal(10, 2) NULL DEFAULT NULL,
  `status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'pending',
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `activity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'exercise',
  `proof_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'manual',
  `device_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `approved_by` int NULL DEFAULT NULL,
  `approved_at` datetime NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `user_id`(`user_id` ASC) USING BTREE,
  INDEX `task_id`(`task_id` ASC) USING BTREE,
  INDEX `approved_by`(`approved_by` ASC) USING BTREE,
  CONSTRAINT `submissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `submissions_ibfk_2` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `submissions_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of submissions
-- ----------------------------

-- ----------------------------
-- Table structure for tanita
-- ----------------------------
DROP TABLE IF EXISTS `tanita`;
CREATE TABLE `tanita`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NULL DEFAULT NULL,
  `submission_id` int NULL DEFAULT NULL,
  `recorded_at` datetime NULL DEFAULT NULL,
  `body_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `gender` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `age` int NULL DEFAULT NULL,
  `height` decimal(5, 2) NULL DEFAULT NULL,
  `waist_cm` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `clothes_weight` decimal(5, 2) NULL DEFAULT NULL,
  `weight` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `fat_pc` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `fat_mass` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `ffm` decimal(5, 2) NULL DEFAULT NULL,
  `muscle_mass` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `tbw_mass` decimal(5, 2) NULL DEFAULT NULL,
  `tbw_pc` decimal(5, 2) NULL DEFAULT NULL,
  `bone_mass` decimal(5, 2) NULL DEFAULT NULL,
  `bmr_kj` int NULL DEFAULT NULL,
  `bmr_kcal` int NULL DEFAULT NULL,
  `metabolic_age` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `visceral_fat` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `bmi` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `ideal_weight` decimal(5, 2) NULL DEFAULT NULL,
  `obesity_degree` decimal(5, 2) NULL DEFAULT NULL,
  `physique_rating` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `session_label` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `event_id` int NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `submission_id`(`submission_id` ASC) USING BTREE,
  INDEX `user_id`(`user_id` ASC) USING BTREE,
  INDEX `fk_tanita_event`(`event_id` ASC) USING BTREE,
  CONSTRAINT `fk_tanita_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `tanita_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `tanita_ibfk_2` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of tanita
-- ----------------------------

-- ----------------------------
-- Table structure for tasks
-- ----------------------------
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NULL DEFAULT NULL,
  `task_date` date NULL DEFAULT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `points` int NULL DEFAULT 0,
  `allowed_days` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `is_active` tinyint(1) NULL DEFAULT 1,
  `metric_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `metric_unit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `goal_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `goal_value` decimal(10, 2) NULL DEFAULT NULL,
  `submission_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'manual',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `event_id`(`event_id` ASC) USING BTREE,
  CONSTRAINT `tasks_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `tasks_chk_1` CHECK (json_valid(`allowed_days`))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of tasks
-- ----------------------------

-- ----------------------------
-- Table structure for team_auto_join_events
-- ----------------------------
DROP TABLE IF EXISTS `team_auto_join_events`;
CREATE TABLE `team_auto_join_events`  (
  `team_id` int NOT NULL,
  `event_id` int NOT NULL,
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`team_id`, `event_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of team_auto_join_events
-- ----------------------------

-- ----------------------------
-- Table structure for team_join_votes
-- ----------------------------
DROP TABLE IF EXISTS `team_join_votes`;
CREATE TABLE `team_join_votes`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `team_id` int NOT NULL,
  `requested_by` int NOT NULL,
  `total_members` int NULL DEFAULT 1,
  `status` enum('pending','approved','rejected','expired') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `unique_vote_request`(`event_id` ASC, `team_id` ASC, `status` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of team_join_votes
-- ----------------------------

-- ----------------------------
-- Table structure for team_vote_records
-- ----------------------------
DROP TABLE IF EXISTS `team_vote_records`;
CREATE TABLE `team_vote_records`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `vote_id` int NOT NULL,
  `user_id` int NOT NULL,
  `vote` enum('yes','no') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `voted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `unique_user_vote`(`vote_id` ASC, `user_id` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of team_vote_records
-- ----------------------------

-- ----------------------------
-- Table structure for teams
-- ----------------------------
DROP TABLE IF EXISTS `teams`;
CREATE TABLE `teams`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `max_members` int NULL DEFAULT 6,
  `host_id` int NULL DEFAULT NULL,
  `total_score` decimal(10, 2) NULL DEFAULT 0.00,
  `is_private` tinyint(1) NULL DEFAULT 0,
  `auto_join_activity` tinyint(1) NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `host_id`(`host_id` ASC) USING BTREE,
  CONSTRAINT `teams_ibfk_1` FOREIGN KEY (`host_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of teams
-- ----------------------------

-- ----------------------------
-- Table structure for user_certificates
-- ----------------------------
DROP TABLE IF EXISTS `user_certificates`;
CREATE TABLE `user_certificates`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_id` int NOT NULL,
  `user_id` int NOT NULL,
  `event_id` int NOT NULL,
  `image_url` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `issued_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `unique_user_event`(`user_id` ASC, `event_id` ASC) USING BTREE,
  INDEX `template_id`(`template_id` ASC) USING BTREE,
  INDEX `event_id`(`event_id` ASC) USING BTREE,
  CONSTRAINT `user_certificates_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `certificate_templates` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `user_certificates_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `user_certificates_ibfk_3` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of user_certificates
-- ----------------------------

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `line_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `team_id` int NULL DEFAULT NULL,
  `email` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `phone` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `fname_th` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `lname_th` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `nickname` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `gender` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `birth_date` date NULL DEFAULT NULL,
  `role` enum('admin','user','host') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'user',
  `id_code` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `picture_url` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `weight` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `height` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `underlying_disease` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `main_goal` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `role_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `total_score` decimal(10, 2) NULL DEFAULT 0.00,
  `points` int NULL DEFAULT 0,
  `can_create_activity` tinyint(1) NULL DEFAULT 0,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `role_detail_1` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `role_detail_2` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `is_suspended` tinyint(1) NULL DEFAULT 0,
  `activity_level` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'sedentary',
  `reset_token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `reset_token_expiry` datetime NULL DEFAULT NULL,
  `last_bot_task_id` int NULL DEFAULT NULL,
  `pending_bot_result` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `line_id`(`line_id` ASC) USING BTREE,
  INDEX `fk_users_team`(`team_id` ASC) USING BTREE,
  INDEX `idx_user_role_team`(`role` ASC, `team_id` ASC) USING BTREE,
  CONSTRAINT `fk_users_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `users_chk_1` CHECK (json_valid(`pending_bot_result`))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of users
-- ----------------------------

-- ----------------------------
-- Table structure for rewards (points redemption shop)
-- ----------------------------
DROP TABLE IF EXISTS `rewards`;
CREATE TABLE `rewards`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `image_url` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `points_required` int NOT NULL DEFAULT 0,
  `stock` int NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `reward_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'item',
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'ทั่วไป',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_active`(`is_active` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for reward_redemptions
-- ----------------------------
DROP TABLE IF EXISTS `reward_redemptions`;
CREATE TABLE `reward_redemptions`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `reward_id` int NOT NULL,
  `status` enum('pending','completed','rejected','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `fulfilled_by` int NULL DEFAULT NULL,
  `fulfilled_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_user`(`user_id` ASC) USING BTREE,
  INDEX `idx_reward`(`reward_id` ASC) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for user_notifications (per-user notifications)
-- ----------------------------
DROP TABLE IF EXISTS `user_notifications`;
CREATE TABLE `user_notifications`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'activity_created',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `link_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `ref_id` int NULL DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_user_read`(`user_id` ASC, `is_read` ASC, `created_at` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for score_events (configurable scoring ledger)
-- ----------------------------
DROP TABLE IF EXISTS `score_events`;
CREATE TABLE `score_events`  (
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

SET FOREIGN_KEY_CHECKS = 1;
