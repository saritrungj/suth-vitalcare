/*
 Navicat Premium Dump SQL

 Source Server         : @SUTH DB ONLINE
 Source Server Type    : MySQL
 Source Server Version : 50730 (5.7.30-log)
 Source Host           : 103.225.168.154:3306
 Source Schema         : vitalcare

 Target Server Type    : MySQL
 Target Server Version : 50730 (5.7.30-log)
 File Encoding         : 65001

 Date: 26/06/2026 14:41:02
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for activity_team_voters
-- ----------------------------
DROP TABLE IF EXISTS `activity_team_voters`;
CREATE TABLE `activity_team_voters`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `vote_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `is_agree` tinyint(1) NOT NULL,
  `voted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `vote_id`(`vote_id`, `user_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of activity_team_voters
-- ----------------------------

-- ----------------------------
-- Table structure for activity_team_votes
-- ----------------------------
DROP TABLE IF EXISTS `activity_team_votes`;
CREATE TABLE `activity_team_votes`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `team_id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `status` enum('voting','approved','rejected','host_override') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'voting',
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of activity_team_votes
-- ----------------------------

-- ----------------------------
-- Table structure for assessment_answers
-- ----------------------------
DROP TABLE IF EXISTS `assessment_answers`;
CREATE TABLE `assessment_answers`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `submission_id` int(11) NULL DEFAULT NULL,
  `health_assessment_id` int(11) NULL DEFAULT NULL,
  `question_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'เก็บข้อความคำถามเพื่อดูประวัติย้อนหลังได้',
  `answer_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'ระบุข้อความคำตอบที่เลือก',
  `score` int(11) NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `submission_id`(`submission_id`) USING BTREE,
  INDEX `fk_health_assessment`(`health_assessment_id`) USING BTREE,
  CONSTRAINT `assessment_answers_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `assessment_submissions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_health_assessment` FOREIGN KEY (`health_assessment_id`) REFERENCES `health_assessments` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 23 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of assessment_answers
-- ----------------------------
INSERT INTO `assessment_answers` VALUES (1, 1, 1, '1) ท่านกินอาหารที่ปรุงสุกและสะอาด บ่อยเพียงใด', 'ทุกวัน', 5);
INSERT INTO `assessment_answers` VALUES (2, 1, 1, '2) ท่านกินอาหารครบ 5 หมู่อย่างหลากหลาย ในสัดส่วนที่เหมาะสม โดยใน 1 มื้อ มีข้าว-แป้ง เนื้อสัตว์ ไขมัน ผักและผลไม้ บ่อยเพียงใด', '3-4 วัน', 3);
INSERT INTO `assessment_answers` VALUES (3, 1, 1, '3) ท่านกินผักและผลไม้ รวมกันอย่างน้อยวันละ 5 กำมือ (400 กรัม) บ่อยเพียงใด', '1-2 วัน', 2);
INSERT INTO `assessment_answers` VALUES (4, 1, 1, '4) ท่านกินขนมหวาน เช่น ขนมเค้ก ช็อกโกแลต ไอศกรีม เป็นต้น หรือดื่มเครื่องดื่มรสหวาน (ผสมน้ำตาล น้ำเชื่อม นมข้น) บ่อยเพียงใด', '3-4 วัน', 3);
INSERT INTO `assessment_answers` VALUES (5, 1, 1, '5) ท่านกินอาหารมัน เช่น ข้าวขาหมู ข้าวมันไก่ แกงกะทิ เป็นต้น บ่อยเพียงใด', '3-4 วัน', 3);
INSERT INTO `assessment_answers` VALUES (6, 1, 1, '6) ท่านกินอาหารเค็มหรือปรุงรสเค็ม เช่น ไส้กรอก ขนมกรุบกรอบ เป็นต้น บ่อยเพียงใด', '3-4 วัน', 3);
INSERT INTO `assessment_answers` VALUES (7, 1, 1, '7) ท่านกินอาหารแปรรูป อาหารทอด ปิ้งย่าง อาหารใส่สี เช่น ไก่ทอด หมูทอด เนื้อย่างรมควัน เป็นต้น บ่อยเพียงใด', '3-4 วัน', 3);
INSERT INTO `assessment_answers` VALUES (8, 1, 1, '8) ท่านดื่มน้ำสะอาด วันละ 6 - 8 แก้ว บ่อยเพียงใด', 'ทุกวัน', 5);
INSERT INTO `assessment_answers` VALUES (9, 1, 1, '1) ท่านลุกขยับร่างกายทุก 2 ชั่วโมง ระหว่างทำงานหรือระหว่างวัน บ่อยเพียงใด', '1-2 วัน', 2);
INSERT INTO `assessment_answers` VALUES (10, 1, 1, '2) ท่านออกกำลังกายจนรู้สึกหัวใจเต้นเร็วขึ้น หรือหายใจแรงขึ้นกว่าปกติ สะสมวันละ 30 นาที บ่อยเพียงใด', '1-2 วัน', 2);
INSERT INTO `assessment_answers` VALUES (11, 1, 1, '3) ท่านฝึกสร้างความเข็งแรงของกล้ามเนื้อ เช่น ดันพื้น ดันกำแพง ลุกนั่ง เป็นต้น บ่อยเพียงใด', '1-2 วัน', 2);
INSERT INTO `assessment_answers` VALUES (12, 1, 1, '1) ท่านสังเกตอารมณ์ หรือความรู้สึกของตนเองในแต่ละวันบ่อยเพียงใด', 'ทุกวัน', 5);
INSERT INTO `assessment_answers` VALUES (13, 1, 1, '2) ท่านมีวิธีผ่อนคลาย เมื่อรู้สึกเครียด หรือไม่สบายใจ เช่น เล่นกีฬา ฟังเพลง ดูภาพยนตร์ เป็นต้น บ่อยเพียงใด', 'ทุกวัน', 5);
INSERT INTO `assessment_answers` VALUES (14, 1, 1, '3) ท่านทำกิจกรรมที่ทำให้จิตใจร่าเริงอยู่เสมอ เช่น พูดคุย กับเพื่อน ทำงานอดิเรก เลี้ยงสัตว์ ร้องเพลง เป็นต้น บ่อยเพียงใด', 'ทุกวัน', 5);
INSERT INTO `assessment_answers` VALUES (15, 1, 1, '4) ท่านสามารถจัดเวลาให้เพียงพอในเรื่อง การทำงาน ชีวิตส่วนตัว และครอบครัว บ่อยเพียงใด', 'ทุกวัน', 5);
INSERT INTO `assessment_answers` VALUES (16, 1, 1, '5) ท่านนอนหลับ วันละ 7 - 8 ชั่วโมง บ่อยเพียงใด', 'ทุกวัน', 5);
INSERT INTO `assessment_answers` VALUES (17, 1, 1, '6) เมื่อท่านเจอสถานการณ์ที่ก่อให้เกิดความเครียด เช่น การทะเลาะเบาะแว้ง หรือขัดแย้งกัน ท่านสามารถ หลีกเลี่ยงได้ บ่อยเพียงใด', 'บางครั้ง', 3);
INSERT INTO `assessment_answers` VALUES (18, 1, 1, '1) ท่านสูบบุหรี่ หรือ บุหรี่ไฟฟ้า หรือไม่', 'ไม่สูบ', 5);
INSERT INTO `assessment_answers` VALUES (19, 1, 1, '2) ในช่วง 1 สัปดาห์ที่ผ่านมา ท่านอยู่ใกล้ชิดหรือรวมกลุ่มกับผู้ที่สูบบุหรี่ หรือบุหรี่ไฟฟ้า บ่อยเพียงใด', 'ไม่ปฏิบัติ', 5);
INSERT INTO `assessment_answers` VALUES (20, 1, 1, '1) ในช่วง 1 เดือนที่ผ่านมา ท่านดื่มสุราหรือเครื่องดื่มแอลกอฮอร์ บ่อยเพียงใด', 'ไม่ดื่ม', 5);
INSERT INTO `assessment_answers` VALUES (21, 1, 1, '2) ในช่วง 1 เดือนที่ผ่านมา ท่านอยู่ใกล้ชิดหรือรวมกลุ่มกับผู้ที่ดื่มสุรา หรือเครื่องดื่มแอลกอฮอล์ บ่อยเพียงใด', 'ไม่ปฏิบัติ', 5);
INSERT INTO `assessment_answers` VALUES (22, 1, 1, '3) ท่านปฏิเสธเมื่อถูกชักชวนให้ดื่มสุราหรือเครื่องดื่มที่มีแอลกอฮอล์จากเพื่อน ครอบครัว และบุคคลใกล้ชิดบ่อยเพียงใด', 'ทุกครั้ง หรือไม่เคยถูกชักชวน', 5);

-- ----------------------------
-- Table structure for assessment_submissions
-- ----------------------------
DROP TABLE IF EXISTS `assessment_submissions`;
CREATE TABLE `assessment_submissions`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_id` int(11) NOT NULL,
  `user_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `test_type` enum('pre_test','post_test') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `total_score` int(11) NULL DEFAULT 0,
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `event_id`(`event_id`) USING BTREE,
  INDEX `user_id`(`user_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of assessment_submissions
-- ----------------------------
INSERT INTO `assessment_submissions` VALUES (1, 683, '408', 'pre_test', 86, '2026-06-08 12:27:53');

-- ----------------------------
-- Table structure for audit_logs
-- ----------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
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
  INDEX `idx_user_action`(`user_id`, `action`) USING BTREE,
  INDEX `idx_created_at`(`created_at`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4867 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of audit_logs
-- ----------------------------
INSERT INTO `audit_logs` VALUES (4821, '401', 'profile_update', NULL, NULL, '{\"updates\":[\"fname_th\",\"lname_th\",\"nickname\",\"email\",\"phone\",\"birth_date\",\"gender\",\"role_type\",\"id_code\",\"role_detail_1\",\"role_detail_2\",\"weight\",\"height\",\"main_goal\",\"underlying_disease\"],\"method\":\"PATCH\",\"url\":\"/api/users/401/profile\"}', 'ผู้ใช้แก้ไขข้อมูลส่วนตัว', '202.28.41.164:60007', '2026-05-15 13:23:10', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
INSERT INTO `audit_logs` VALUES (4822, '401', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 401)', '202.28.41.105:34820', '2026-05-15 13:32:24', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36');
INSERT INTO `audit_logs` VALUES (4823, '401', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 401)', '202.28.41.105:50114', '2026-05-15 13:34:18', 'Mozilla/5.0 (Linux; Android 16; SM-A356E Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/148.0.7778.120 Mobile Safari/537.36 Line/26.6.1 LIFF');
INSERT INTO `audit_logs` VALUES (4824, '402', 'profile_update', NULL, NULL, '{\"updates\":[\"fname_th\",\"lname_th\",\"nickname\",\"email\",\"phone\",\"birth_date\",\"gender\",\"role_type\",\"id_code\",\"role_detail_1\",\"role_detail_2\",\"weight\",\"height\",\"underlying_disease\",\"main_goal\"],\"method\":\"PATCH\",\"url\":\"/api/users/402/profile\"}', 'ผู้ใช้แก้ไขข้อมูลส่วนตัว', '203.158.2.216:54491', '2026-05-15 13:35:11', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
INSERT INTO `audit_logs` VALUES (4825, '401', 'create_activity', 'activity', '681', '{\"title\":\"ทดสอบวิ่ง\"}', 'สร้างกิจกรรม: ทดสอบวิ่ง', NULL, '2026-05-15 13:56:26', NULL);
INSERT INTO `audit_logs` VALUES (4826, '401', 'edit_activity', 'activity', '681', '{\"updates\":[\"title\",\"poster\",\"start_date\",\"end_date\",\"publish_start_date\",\"registration_start_date\",\"registration_end_date\",\"is_continuous_registration\",\"is_continuous_event\",\"start_time\",\"end_time\",\"max_slots\",\"is_unlimited_max_slots\",\"detail\",\"activity_mode\",\"tasks\",\"location_name\",\"organizer\",\"event_code\",\"event_password\",\"visibility\",\"health_config\",\"goal_config\",\"certificate_config\",\"assessment_config\",\"team_id\",\"auto_join_team\",\"status\",\"userId\"]}', 'แก้ไขกิจกรรม: ทดสอบวิ่ง', NULL, '2026-05-15 14:00:13', NULL);
INSERT INTO `audit_logs` VALUES (4827, '401', 'create_banner', 'banner', '95', '{\"title\":\"คู่มือการใช้งาน\",\"method\":\"POST\",\"url\":\"/api/banners\"}', 'สร้างแบนเนอร์: คู่มือการใช้งาน', '202.28.41.105:38048', '2026-05-15 14:02:07', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36');
INSERT INTO `audit_logs` VALUES (4828, '401', 'create_banner', 'banner', '96', '{\"title\":\"แบบสอบถามความพึงพอใจการใช้งาน Web Site\",\"method\":\"POST\",\"url\":\"/api/banners\"}', 'สร้างแบนเนอร์: แบบสอบถามความพึงพอใจการใช้งาน Web Site', '202.28.41.105:38048', '2026-05-15 14:03:05', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36');
INSERT INTO `audit_logs` VALUES (4829, '401', 'edit_activity', 'activity', '681', '{\"updates\":[\"title\",\"poster\",\"start_date\",\"end_date\",\"publish_start_date\",\"registration_start_date\",\"registration_end_date\",\"is_continuous_registration\",\"is_continuous_event\",\"start_time\",\"end_time\",\"max_slots\",\"is_unlimited_max_slots\",\"detail\",\"activity_mode\",\"tasks\",\"location_name\",\"organizer\",\"event_code\",\"event_password\",\"visibility\",\"health_config\",\"goal_config\",\"certificate_config\",\"assessment_config\",\"team_id\",\"auto_join_team\",\"status\",\"userId\"]}', 'แก้ไขกิจกรรม: ทดสอบวิ่ง', NULL, '2026-05-15 14:06:35', NULL);
INSERT INTO `audit_logs` VALUES (4830, '401', 'edit_activity', 'activity', '681', '{\"updates\":[\"title\",\"poster\",\"start_date\",\"end_date\",\"publish_start_date\",\"registration_start_date\",\"registration_end_date\",\"is_continuous_registration\",\"is_continuous_event\",\"start_time\",\"end_time\",\"max_slots\",\"is_unlimited_max_slots\",\"detail\",\"activity_mode\",\"tasks\",\"location_name\",\"organizer\",\"event_code\",\"event_password\",\"visibility\",\"health_config\",\"goal_config\",\"certificate_config\",\"assessment_config\",\"team_id\",\"auto_join_team\",\"status\",\"userId\"]}', 'แก้ไขกิจกรรม: ทดสอบวิ่ง', NULL, '2026-05-15 14:07:14', NULL);
INSERT INTO `audit_logs` VALUES (4831, '401', 'edit_activity', 'activity', '681', '{\"updates\":[\"title\",\"poster\",\"start_date\",\"end_date\",\"publish_start_date\",\"registration_start_date\",\"registration_end_date\",\"is_continuous_registration\",\"is_continuous_event\",\"start_time\",\"end_time\",\"max_slots\",\"is_unlimited_max_slots\",\"detail\",\"activity_mode\",\"tasks\",\"location_name\",\"organizer\",\"event_code\",\"event_password\",\"visibility\",\"health_config\",\"goal_config\",\"certificate_config\",\"assessment_config\",\"team_id\",\"auto_join_team\",\"status\",\"userId\"]}', 'แก้ไขกิจกรรม: ทดสอบวิ่ง', NULL, '2026-05-15 14:08:57', NULL);
INSERT INTO `audit_logs` VALUES (4832, '401', 'edit_activity', 'activity', '681', '{\"updates\":[\"title\",\"poster\",\"start_date\",\"end_date\",\"publish_start_date\",\"registration_start_date\",\"registration_end_date\",\"is_continuous_registration\",\"is_continuous_event\",\"start_time\",\"end_time\",\"max_slots\",\"is_unlimited_max_slots\",\"detail\",\"activity_mode\",\"tasks\",\"location_name\",\"organizer\",\"event_code\",\"event_password\",\"visibility\",\"health_config\",\"goal_config\",\"certificate_config\",\"assessment_config\",\"team_id\",\"auto_join_team\",\"status\",\"userId\"]}', 'แก้ไขกิจกรรม: ทดสอบวิ่ง', NULL, '2026-05-15 14:09:46', NULL);
INSERT INTO `audit_logs` VALUES (4833, '401', 'edit_banner', 'banner', '95', '{\"updates\":[\"title\",\"subtitle\",\"image_url\",\"link_url\",\"link_type\",\"link_activity_id\",\"positions\",\"sort_order\",\"is_active\",\"start_date\",\"end_date\"],\"method\":\"PATCH\",\"url\":\"/api/banners/95\"}', 'แก้ไขแบนเนอร์ ID: 95', '202.28.41.105:36998', '2026-05-15 14:12:10', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36');
INSERT INTO `audit_logs` VALUES (4834, '401', 'edit_banner', 'banner', '96', '{\"updates\":[\"title\",\"subtitle\",\"image_url\",\"link_url\",\"link_type\",\"link_activity_id\",\"positions\",\"sort_order\",\"is_active\",\"start_date\",\"end_date\"],\"method\":\"PATCH\",\"url\":\"/api/banners/96\"}', 'แก้ไขแบนเนอร์ ID: 96', '202.28.41.105:36998', '2026-05-15 14:12:21', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36');
INSERT INTO `audit_logs` VALUES (4835, '401', 'edit_activity', 'activity', '681', '{\"updates\":[\"title\",\"poster\",\"start_date\",\"end_date\",\"publish_start_date\",\"registration_start_date\",\"registration_end_date\",\"is_continuous_registration\",\"is_continuous_event\",\"start_time\",\"end_time\",\"max_slots\",\"is_unlimited_max_slots\",\"detail\",\"activity_mode\",\"tasks\",\"location_name\",\"organizer\",\"event_code\",\"event_password\",\"visibility\",\"health_config\",\"goal_config\",\"certificate_config\",\"assessment_config\",\"team_id\",\"auto_join_team\",\"status\",\"userId\"]}', 'แก้ไขกิจกรรม: ทดสอบวิ่ง', NULL, '2026-05-15 14:15:25', NULL);
INSERT INTO `audit_logs` VALUES (4836, '401', 'create_activity', 'activity', '682', '{\"title\":\"ทดสอบกิจกรรมว่ายน้ำ\"}', 'สร้างกิจกรรม: ทดสอบกิจกรรมว่ายน้ำ', NULL, '2026-05-15 14:20:08', NULL);
INSERT INTO `audit_logs` VALUES (4837, '401', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 401)', '203.158.2.131:63650', '2026-05-15 15:09:18', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0');
INSERT INTO `audit_logs` VALUES (4838, '401', 'EXPORT', 'events', '682', '{\"method\":\"GET\",\"url\":\"/api/export/activities/682/monthly-report?start_date=2026-05-15&end_date=2026-05-31\"}', 'ผู้ใช้ส่งออกรายงานกิจกรรมแบบรายเดือน (ทดสอบกิจกรรมว่ายน้ำ)', '203.158.2.131:63650', '2026-05-15 15:13:31', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0');
INSERT INTO `audit_logs` VALUES (4839, '402', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 402)', '49.237.87.121:16610', '2026-05-15 15:15:04', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36');
INSERT INTO `audit_logs` VALUES (4840, '401', 'leave_activity_solo', 'activity', '681', NULL, 'User ID 401 ออกจากกิจกรรม', NULL, '2026-05-20 10:54:02', NULL);
INSERT INTO `audit_logs` VALUES (4841, '402', 'delete_activity', 'activity', '682', NULL, 'ลบกิจกรรม ID: 682', NULL, '2026-06-02 15:04:02', NULL);
INSERT INTO `audit_logs` VALUES (4842, '402', 'delete_activity', 'activity', '681', NULL, 'ลบกิจกรรม ID: 681', NULL, '2026-06-02 15:04:06', NULL);
INSERT INTO `audit_logs` VALUES (4843, '402', 'delete_team', 'team', '117', NULL, 'ลบทีม: eiei (ID: 117)', NULL, '2026-06-02 15:04:11', NULL);
INSERT INTO `audit_logs` VALUES (4844, '403', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 403)', '1.47.66.205:25952', '2026-06-05 10:21:17', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
INSERT INTO `audit_logs` VALUES (4845, '404', 'profile_update', NULL, NULL, '{\"updates\":[\"fname_th\",\"lname_th\",\"nickname\",\"email\",\"phone\",\"birth_date\",\"gender\",\"role_type\",\"id_code\",\"role_detail_1\",\"role_detail_2\",\"weight\",\"height\",\"underlying_disease\",\"main_goal\"],\"method\":\"PATCH\",\"url\":\"/api/users/404/profile\"}', 'ผู้ใช้แก้ไขข้อมูลส่วนตัว', '203.158.2.197:46460', '2026-06-05 11:15:28', 'Mozilla/5.0 (Linux; Android 14; V2150 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/148.0.7778.179 Mobile Safari/537.36 Line/26.8.0/IAB');
INSERT INTO `audit_logs` VALUES (4846, '405', 'profile_update', NULL, NULL, '{\"updates\":[\"fname_th\",\"lname_th\",\"nickname\",\"email\",\"phone\",\"birth_date\",\"gender\",\"role_type\",\"id_code\",\"role_detail_1\",\"role_detail_2\",\"weight\",\"height\",\"underlying_disease\",\"main_goal\"],\"method\":\"PATCH\",\"url\":\"/api/users/405/profile\"}', 'ผู้ใช้แก้ไขข้อมูลส่วนตัว', '49.237.102.169:29664', '2026-06-05 12:40:24', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
INSERT INTO `audit_logs` VALUES (4847, '401', 'create_activity', 'activity', '683', '{\"title\":\"วิ่งเพื่อสุขภาพ\"}', 'สร้างกิจกรรม: วิ่งเพื่อสุขภาพ', NULL, '2026-06-05 13:18:53', NULL);
INSERT INTO `audit_logs` VALUES (4848, '406', 'profile_update', NULL, NULL, '{\"updates\":[\"fname_th\",\"lname_th\",\"nickname\",\"email\",\"phone\",\"birth_date\",\"gender\",\"role_type\",\"id_code\",\"role_detail_1\",\"role_detail_2\",\"weight\",\"height\",\"main_goal\",\"underlying_disease\"],\"method\":\"PATCH\",\"url\":\"/api/users/406/profile\"}', 'ผู้ใช้แก้ไขข้อมูลส่วนตัว', '1.47.29.61:27376', '2026-06-08 10:12:20', 'Mozilla/5.0 (Linux; Android 15; V2202 Build/AP3A.240905.015.A2; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/148.0.7778.178 Mobile Safari/537.36 Line/26.7.1 LIFF');
INSERT INTO `audit_logs` VALUES (4849, '407', 'profile_update', NULL, NULL, '{\"updates\":[\"fname_th\",\"lname_th\",\"nickname\",\"email\",\"phone\",\"birth_date\",\"gender\",\"role_type\",\"id_code\",\"role_detail_1\",\"role_detail_2\",\"weight\",\"height\",\"main_goal\",\"underlying_disease\"],\"method\":\"PATCH\",\"url\":\"/api/users/407/profile\"}', 'ผู้ใช้แก้ไขข้อมูลส่วนตัว', '203.158.2.107:53463', '2026-06-08 10:23:58', 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/26.7.2 LIFF');
INSERT INTO `audit_logs` VALUES (4850, '408', 'profile_update', NULL, NULL, '{\"updates\":[\"fname_th\",\"lname_th\",\"nickname\",\"email\",\"phone\",\"birth_date\",\"gender\",\"role_type\",\"id_code\",\"role_detail_1\",\"role_detail_2\",\"weight\",\"height\",\"main_goal\",\"underlying_disease\"],\"method\":\"PATCH\",\"url\":\"/api/users/408/profile\"}', 'ผู้ใช้แก้ไขข้อมูลส่วนตัว', '49.237.184.7:2307', '2026-06-08 12:25:44', 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/26.7.2 LIFF');
INSERT INTO `audit_logs` VALUES (4851, '407', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 407)', '203.158.2.175:62428', '2026-06-08 14:38:19', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
INSERT INTO `audit_logs` VALUES (4852, '402', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 402)', '203.158.2.216:59771', '2026-06-08 14:56:08', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36');
INSERT INTO `audit_logs` VALUES (4853, '402', 'dissolve_team', 'team', '119', NULL, 'ยุบทีม ID 119 เนื่องจาก Host ออกจากทีม', NULL, '2026-06-08 15:09:31', NULL);
INSERT INTO `audit_logs` VALUES (4854, '402', 'create_activity', 'activity', '684', '{\"title\":\"ทดสอบ\"}', 'สร้างกิจกรรม: ทดสอบ', NULL, '2026-06-08 15:12:08', NULL);
INSERT INTO `audit_logs` VALUES (4855, '402', 'edit_activity', 'activity', '683', '{\"updates\":[\"title\",\"poster\",\"start_date\",\"end_date\",\"publish_start_date\",\"registration_start_date\",\"registration_end_date\",\"is_continuous_registration\",\"is_continuous_event\",\"start_time\",\"end_time\",\"max_slots\",\"is_unlimited_max_slots\",\"detail\",\"activity_mode\",\"tasks\",\"location_name\",\"organizer\",\"event_code\",\"event_password\",\"visibility\",\"health_config\",\"goal_config\",\"certificate_config\",\"assessment_config\",\"team_id\",\"auto_join_team\",\"status\",\"userId\"]}', 'แก้ไขกิจกรรม: วิ่งเพื่อสุขภาพ', NULL, '2026-06-08 15:14:37', NULL);
INSERT INTO `audit_logs` VALUES (4856, '402', 'delete_team', 'team', '118', NULL, 'ลบทีม: stalker (ID: 118)', NULL, '2026-06-08 15:15:34', NULL);
INSERT INTO `audit_logs` VALUES (4857, '402', 'delete_activity', 'activity', '684', NULL, 'ลบกิจกรรม ID: 684', NULL, '2026-06-08 15:15:41', NULL);
INSERT INTO `audit_logs` VALUES (4858, '402', 'EXPORT', 'events', '683', '{\"method\":\"GET\",\"url\":\"/api/export/activities/683/monthly-report?start_date=2026-06-05&end_date=2026-06-30\"}', 'ผู้ใช้ส่งออกรายงานกิจกรรมแบบรายเดือน (วิ่งเพื่อสุขภาพ)', '203.158.2.216:64696', '2026-06-08 15:17:45', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36');
INSERT INTO `audit_logs` VALUES (4859, '406', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 406)', '203.158.2.123:5895', '2026-06-08 15:54:13', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0');
INSERT INTO `audit_logs` VALUES (4860, '402', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 402)', '203.158.2.216:62588', '2026-06-09 09:11:33', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36');
INSERT INTO `audit_logs` VALUES (4861, '402', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 402)', '203.158.2.121:36492', '2026-06-09 09:12:12', 'Mozilla/5.0 (Linux; Android 16; SM-S938B Build/BP4A.251205.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/148.0.7778.216 Mobile Safari/537.36 Line/26.8.0 LIFF');
INSERT INTO `audit_logs` VALUES (4862, '402', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 402)', '203.158.2.121:36492', '2026-06-09 09:12:12', 'Mozilla/5.0 (Linux; Android 16; SM-S938B Build/BP4A.251205.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/148.0.7778.216 Mobile Safari/537.36 Line/26.8.0 LIFF');
INSERT INTO `audit_logs` VALUES (4863, '404', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 404)', '58.11.72.242:6596', '2026-06-20 18:30:09', 'Mozilla/5.0 (Linux; Android 14; V2150) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.6312.118 Mobile Safari/537.36 VivoBrowser/15.1.0.3');
INSERT INTO `audit_logs` VALUES (4864, '403', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 403)', '1.46.29.244:25199', '2026-06-22 14:43:47', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1');
INSERT INTO `audit_logs` VALUES (4865, '402', 'login_line', NULL, NULL, '{\"method\":\"POST\",\"url\":\"/api/users/login\"}', 'ผู้ใช้ล็อกอินผ่าน LINE (ID: 402)', '49.231.147.158:51661', '2026-06-25 14:50:04', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36');
INSERT INTO `audit_logs` VALUES (4866, '402', 'admin_update_user', 'user', '408', '{\"updates\":[\"fname_th\",\"lname_th\",\"nickname\",\"email\",\"phone\",\"gender\",\"role\",\"role_type\",\"role_detail_1\",\"role_detail_2\",\"address\",\"weight\",\"height\",\"birth_date\",\"main_goal\",\"underlying_disease\",\"id_code\"]}', 'แอดมินแก้ไขข้อมูลผู้ใช้ ID: 408', NULL, '2026-06-25 15:17:49', NULL);

-- ----------------------------
-- Table structure for banners
-- ----------------------------
DROP TABLE IF EXISTS `banners`;
CREATE TABLE `banners`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `subtitle` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `image_url` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `link_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `link_type` enum('activity','url','none') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'none',
  `link_activity_id` int(11) NULL DEFAULT NULL,
  `sort_order` int(11) NULL DEFAULT 0,
  `is_active` tinyint(1) NULL DEFAULT 1,
  `start_date` date NULL DEFAULT NULL,
  `end_date` date NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `positions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `link_activity_id`(`link_activity_id`) USING BTREE,
  CONSTRAINT `banners_ibfk_1` FOREIGN KEY (`link_activity_id`) REFERENCES `events` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 97 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of banners
-- ----------------------------
INSERT INTO `banners` VALUES (95, 'คู่มือการใช้งาน', NULL, '/uploads/banners/banner-2026-05-15-6txdko.png', 'https://embed.app.guidde.com/playbooks/wf5odeRFzy4K2pKVucGYaC?mode=videoOnly', 'url', NULL, 0, 1, NULL, NULL, '2026-05-15 14:02:07', '[\"activity\"]');
INSERT INTO `banners` VALUES (96, 'แบบสอบถามความพึงพอใจการใช้งาน Web Site', NULL, '/uploads/banners/banner-2026-05-15-rdwsfz.png', 'https://form.typeform.com/to/UHZfzTBm', 'url', NULL, 0, 1, NULL, NULL, '2026-05-15 14:03:05', '[\"activity\"]');

-- ----------------------------
-- Table structure for bonus_points
-- ----------------------------
DROP TABLE IF EXISTS `bonus_points`;
CREATE TABLE `bonus_points`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `points` int(11) NOT NULL,
  `reason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `given_by` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_event_user`(`event_id`, `user_id`) USING BTREE,
  INDEX `idx_event`(`event_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of bonus_points
-- ----------------------------

-- ----------------------------
-- Table structure for certificate_templates
-- ----------------------------
DROP TABLE IF EXISTS `certificate_templates`;
CREATE TABLE `certificate_templates`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_id` int(11) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'เกียรติบัตร',
  `background_url` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `canvas_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT 'Fabric.js JSON ทั้ง canvas',
  `width` int(11) NULL DEFAULT 1754 COMMENT 'ความกว้าง pixels (A4 landscape 150dpi)',
  `height` int(11) NULL DEFAULT 1240 COMMENT 'ความสูง pixels',
  `issue_mode` enum('goal_complete','event_end','manual','immediately') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'event_end',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `event_id`(`event_id`) USING BTREE,
  CONSTRAINT `certificate_templates_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of certificate_templates
-- ----------------------------

-- ----------------------------
-- Table structure for event_favorites
-- ----------------------------
DROP TABLE IF EXISTS `event_favorites`;
CREATE TABLE `event_favorites`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `user_event`(`user_id`, `event_id`) USING BTREE,
  INDEX `event_id`(`event_id`) USING BTREE,
  CONSTRAINT `event_favorites_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `event_favorites_ibfk_2` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of event_favorites
-- ----------------------------

-- ----------------------------
-- Table structure for event_leaderboards
-- ----------------------------
DROP TABLE IF EXISTS `event_leaderboards`;
CREATE TABLE `event_leaderboards`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_id` int(11) NULL DEFAULT NULL,
  `user_id` int(11) NULL DEFAULT NULL,
  `rank` int(11) NULL DEFAULT NULL,
  `score` decimal(10, 2) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `event_id`(`event_id`) USING BTREE,
  INDEX `user_id`(`user_id`) USING BTREE,
  CONSTRAINT `event_leaderboards_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `event_leaderboards_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of event_leaderboards
-- ----------------------------
INSERT INTO `event_leaderboards` VALUES (1, 683, 402, 0, 10.00);

-- ----------------------------
-- Table structure for events
-- ----------------------------
DROP TABLE IF EXISTS `events`;
CREATE TABLE `events`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
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
  `max_slots` int(11) NULL DEFAULT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'กิจกรรม',
  `activity_mode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'event',
  `leaderboard_enabled` tinyint(1) NULL DEFAULT 0,
  `team_mode` tinyint(1) NULL DEFAULT 0,
  `location_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `organizer` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `rules_regulations` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `inclusions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `event_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `event_password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `visibility` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `health_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'open',
  `publish_start_date` date NULL DEFAULT NULL,
  `created_by` int(11) NULL DEFAULT NULL,
  `team_id` int(11) NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `goal_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `certificate_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `assessment_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `auto_join_team` tinyint(1) NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `created_by`(`created_by`) USING BTREE,
  INDEX `idx_event_search`(`start_date`, `end_date`, `status`) USING BTREE,
  CONSTRAINT `events_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 684 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of events
-- ----------------------------
INSERT INTO `events` VALUES (683, 'วิ่งเพื่อสุขภาพ', '/uploads/activity/กิจกรรม-2026-06-05-j5jz9e.png', '[{\"title\":\"กิจกรรมเพิ่มเติม\",\"content\":\"ทุกวัน จันทร์-ศุกร์ เวลา 18:00-19:00 น.\\n1.ให้ทุกคนไปรวมกลุ่มที่หลังอาคาร\\n2.แต่งกายให้เรียบร้อยให้เหมาะกับการออกกำลังกาย\\n3.เมื่อทำกิจกรรมเสร็จแล้วกรุณาส่งหลักฐานลงในระบบทุกครั้ง\",\"image\":\"/uploads/activity/วิ่งเพื่อสุขภาพ-section-2026-06-05-pyz6h8.png\"}]', NULL, NULL, NULL, NULL, 1, 1, 0, '08:00:00', '17:00:00', 100, 'กิจกรรม', 'event', 0, 0, 'สวนลุม', 'สถานประกอบการ', NULL, NULL, '', NULL, '[\"general\"]', '{\"tanita_dates\":[{\"label\":\"เก็บค่าองค์ประกอบของร่างกายครั้งที่ 1\",\"date\":\"\"},{\"label\":\"เก็บค่าองค์ประกอบของร่างกายครั้งที่ 2\",\"date\":\"\"}]}', 'open', NULL, NULL, NULL, '2026-06-05 13:18:53', '{\"enabled\":false,\"mode\":\"solo\",\"team_size\":3,\"target_type\":\"points\",\"target_value\":1000,\"reward_text\":\"\"}', '{\"enabled\":false,\"issue_mode\":\"immediately\"}', '{\"pre_test\":{\"enabled\":true,\"title\":\"แบบทดสอบก่อนเข้าร่วม (Pre-test)\",\"questions\":[]},\"post_test\":{\"enabled\":true,\"title\":\"แบบทดสอบหลังเข้าร่วม (Post-test)\",\"questions\":[]}}', 0);

-- ----------------------------
-- Table structure for gamification_titles
-- ----------------------------
DROP TABLE IF EXISTS `gamification_titles`;
CREATE TABLE `gamification_titles`  (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `rarity` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'common',
  `conditions` json NULL,
  `hint` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `icon` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NULL DEFAULT 1,
  `unlock_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'conditions',
  `unlock_code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of gamification_titles
-- ----------------------------

-- ----------------------------
-- Table structure for health_assessments
-- ----------------------------
DROP TABLE IF EXISTS `health_assessments`;
CREATE TABLE `health_assessments`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `total_score` int(11) NULL DEFAULT NULL,
  `overall_level` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `admin_comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `commented_at` timestamp NULL DEFAULT NULL,
  `commented_by` int(11) NULL DEFAULT NULL,
  `summary_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `user_id`(`user_id`) USING BTREE,
  CONSTRAINT `health_assessments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of health_assessments
-- ----------------------------
INSERT INTO `health_assessments` VALUES (1, 408, 86, 'พอใช้', NULL, NULL, NULL, '[{\"sectionId\":\"food\",\"score\":27,\"level\":\"ดี\"},{\"sectionId\":\"exercise\",\"score\":6,\"level\":\"พอใช้\"},{\"sectionId\":\"emotion\",\"score\":28,\"level\":\"ดีมาก\"},{\"sectionId\":\"smoke\",\"score\":10,\"level\":\"ดีมาก\"},{\"sectionId\":\"alcohol\",\"score\":15,\"level\":\"ดีมาก\"}]', '2026-06-08 12:27:53');

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
  `sort_order` int(11) NULL DEFAULT 0,
  `is_active` tinyint(1) NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `category`(`category`, `key_name`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of master_configs
-- ----------------------------

-- ----------------------------
-- Table structure for mission_submissions
-- ----------------------------
DROP TABLE IF EXISTS `mission_submissions`;
CREATE TABLE `mission_submissions`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `mission_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `submission_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `value` decimal(10, 2) NULL DEFAULT NULL,
  `image_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `mission_id`(`mission_id`) USING BTREE,
  INDEX `user_id`(`user_id`) USING BTREE,
  CONSTRAINT `mission_submissions_ibfk_1` FOREIGN KEY (`mission_id`) REFERENCES `activity_missions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `mission_submissions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of mission_submissions
-- ----------------------------

-- ----------------------------
-- Table structure for registrations
-- ----------------------------
DROP TABLE IF EXISTS `registrations`;
CREATE TABLE `registrations`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NULL DEFAULT NULL,
  `event_id` int(11) NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `user_id`(`user_id`, `event_id`) USING BTREE,
  INDEX `event_id`(`event_id`) USING BTREE,
  CONSTRAINT `registrations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `registrations_ibfk_2` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 955 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of registrations
-- ----------------------------
INSERT INTO `registrations` VALUES (953, 408, 683, '2026-06-08 12:26:29');
INSERT INTO `registrations` VALUES (954, 402, 683, '2026-06-08 14:56:59');

-- ----------------------------
-- Table structure for submissions
-- ----------------------------
DROP TABLE IF EXISTS `submissions`;
CREATE TABLE `submissions`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NULL DEFAULT NULL,
  `task_id` int(11) NULL DEFAULT NULL,
  `img_url` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `text_response` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `value` decimal(10, 2) NULL DEFAULT NULL,
  `status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'pending',
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `activity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'exercise',
  `proof_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'manual',
  `device_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `approved_by` int(11) NULL DEFAULT NULL,
  `approved_at` datetime NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `user_id`(`user_id`) USING BTREE,
  INDEX `task_id`(`task_id`) USING BTREE,
  INDEX `approved_by`(`approved_by`) USING BTREE,
  CONSTRAINT `submissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `submissions_ibfk_2` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `submissions_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of submissions
-- ----------------------------
INSERT INTO `submissions` VALUES (1, 402, 1299, '/uploads/submissions/วิ่งสะสมระยะทาง-2026-06-08-mgwomc.png', NULL, 6.06, 'approved', NULL, 'exercise', 'photo', NULL, NULL, '2026-06-08 14:58:47', '2026-06-08 14:58:47');

-- ----------------------------
-- Table structure for tanita
-- ----------------------------
DROP TABLE IF EXISTS `tanita`;
CREATE TABLE `tanita`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NULL DEFAULT NULL,
  `submission_id` int(11) NULL DEFAULT NULL,
  `recorded_at` datetime NULL DEFAULT NULL,
  `body_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `gender` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `age` int(11) NULL DEFAULT NULL,
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
  `bmr_kj` int(11) NULL DEFAULT NULL,
  `bmr_kcal` int(11) NULL DEFAULT NULL,
  `metabolic_age` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `visceral_fat` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `bmi` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `ideal_weight` decimal(5, 2) NULL DEFAULT NULL,
  `obesity_degree` decimal(5, 2) NULL DEFAULT NULL,
  `physique_rating` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `session_label` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `event_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `submission_id`(`submission_id`) USING BTREE,
  INDEX `user_id`(`user_id`) USING BTREE,
  INDEX `fk_tanita_event`(`event_id`) USING BTREE,
  CONSTRAINT `fk_tanita_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `tanita_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `tanita_ibfk_2` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 140 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of tanita
-- ----------------------------
INSERT INTO `tanita` VALUES (137, 406, NULL, '2026-06-08 03:12:19', 'STANDARD', NULL, 32, 160.00, '69', 0.50, 'b9d51499cb03a4c7cc6798e34b4907a6:bacaef5bdb8c28043e81cd0ad94322d0', 'cab5c233b38aadc729826040ae8d8e25:b3c098a6946f68baefbe898eb3ca5c35', '4578d925cf007ac1dbef8a639f5a934e:ac33fe9b45654a53839fc6f2cf5eceb0', 21.10, 'e3a522ea281783e6cc5885d0c69d2e04:68a27f603079816c5860d47bf60a56a9', 15.40, 46.90, 2.10, 1137, 272, 'a1a407bb77b8267dc1a236f13d230ac5:2ba895c25bbd2c2584927632e2f62868', '57e6496629a363739377874914f1214b:d43f0b346a30a5390b74fad042a873ce', '7b338565f54b56cb4f91ccd3855a474c:c7873b7e68abcb6df1fd72bc40e1e884', 56.30, 0.00, NULL, NULL, NULL);
INSERT INTO `tanita` VALUES (138, 407, NULL, '2026-06-08 03:23:58', 'STANDARD', NULL, 38, 150.00, '92', 0.50, '958378b33cf37cbb4940b52395e94edc:ec242d4bfb7e0aa3ec6f626680a233f4', 'cd9ddd802415e9d37ee69b3115ec55e9:4171ad716c7e888f35d89022b0ba546d', '9c375e3520104aead8d8cd9e7ec62b4c:cf31251add795485285a16484aae9ee1', 37.00, '88441cdd5a5367a9d3c0aef2e336c6dc:173fe17f5c1688963f06e056b921935f', 28.50, 28.50, 46.40, 4761, 1138, '0daa391e8d4a601dd9d39f4f57ce0e90:93e4af5316503faee29a2279b8e726ac', '9b0eac62c4a409e45384b0b277f4b4ce:13f72692a949dd9379e01b2a9eedf6b9', 'e49c7acb47fcd389be3c4eaee6bdfce5:b0f3f5fc68ce6d5256e01632d53ea0bf', 49.50, 24.00, '++++', NULL, NULL);
INSERT INTO `tanita` VALUES (139, 408, NULL, '2026-06-08 05:25:44', 'STANDARD', NULL, 37, 169.00, '95', NULL, '48549caf8316680d259c4eec7595c4c9:b3620aec7cd632901d101fcd9bafc586', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- ----------------------------
-- Table structure for tasks
-- ----------------------------
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_id` int(11) NULL DEFAULT NULL,
  `task_date` date NULL DEFAULT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `points` int(11) NULL DEFAULT 0,
  `allowed_days` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `is_active` tinyint(1) NULL DEFAULT 1,
  `metric_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `metric_unit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `goal_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `goal_value` decimal(10, 2) NULL DEFAULT NULL,
  `submission_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'manual',
  `use_ocr` tinyint(1) NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `event_id`(`event_id`) USING BTREE,
  CONSTRAINT `tasks_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1302 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of tasks
-- ----------------------------
INSERT INTO `tasks` VALUES (1299, 683, NULL, 'exercise', 'วิ่งสะสมระยะทาง', 10, '[0,1,2,3,4,5,6]', 1, 'distance', 'km', NULL, NULL, 'photo', 1);
INSERT INTO `tasks` VALUES (1301, 683, NULL, 'exercise', 'อาหาร', 10, '[0,1,2,3,4,5,6]', 1, 'distance', 'meal', NULL, NULL, 'photo', 0);

-- ----------------------------
-- Table structure for team_auto_join_events
-- ----------------------------
DROP TABLE IF EXISTS `team_auto_join_events`;
CREATE TABLE `team_auto_join_events`  (
  `team_id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`team_id`, `event_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of team_auto_join_events
-- ----------------------------

-- ----------------------------
-- Table structure for team_join_votes
-- ----------------------------
DROP TABLE IF EXISTS `team_join_votes`;
CREATE TABLE `team_join_votes`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_id` int(11) NOT NULL,
  `team_id` int(11) NOT NULL,
  `requested_by` int(11) NOT NULL,
  `total_members` int(11) NULL DEFAULT 1,
  `status` enum('pending','approved','rejected','expired') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `unique_vote_request`(`event_id`, `team_id`, `status`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of team_join_votes
-- ----------------------------

-- ----------------------------
-- Table structure for team_vote_records
-- ----------------------------
DROP TABLE IF EXISTS `team_vote_records`;
CREATE TABLE `team_vote_records`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `vote_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `vote` enum('yes','no') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `voted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `unique_user_vote`(`vote_id`, `user_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of team_vote_records
-- ----------------------------

-- ----------------------------
-- Table structure for teams
-- ----------------------------
DROP TABLE IF EXISTS `teams`;
CREATE TABLE `teams`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `max_members` int(11) NULL DEFAULT 6,
  `host_id` int(11) NULL DEFAULT NULL,
  `total_score` decimal(10, 2) NULL DEFAULT 0.00,
  `is_private` tinyint(1) NULL DEFAULT 0,
  `auto_join_activity` tinyint(1) NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `host_id`(`host_id`) USING BTREE,
  CONSTRAINT `teams_ibfk_1` FOREIGN KEY (`host_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of teams
-- ----------------------------

-- ----------------------------
-- Table structure for user_certificates
-- ----------------------------
DROP TABLE IF EXISTS `user_certificates`;
CREATE TABLE `user_certificates`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `template_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `image_url` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `issued_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `unique_user_event`(`user_id`, `event_id`) USING BTREE,
  INDEX `template_id`(`template_id`) USING BTREE,
  INDEX `event_id`(`event_id`) USING BTREE,
  CONSTRAINT `user_certificates_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `certificate_templates` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `user_certificates_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `user_certificates_ibfk_3` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of user_certificates
-- ----------------------------

-- ----------------------------
-- Table structure for user_titles
-- ----------------------------
DROP TABLE IF EXISTS `user_titles`;
CREATE TABLE `user_titles`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `title_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `unlocked_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `unique_user_title`(`user_id`, `title_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 20 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of user_titles
-- ----------------------------
INSERT INTO `user_titles` VALUES (18, 401, '1778828649554', '2026-05-15 14:04:23');
INSERT INTO `user_titles` VALUES (19, 402, '1778828649554', '2026-05-18 09:43:22');

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `line_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `team_id` int(11) NULL DEFAULT NULL,
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
  `points` int(11) NULL DEFAULT 0,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `role_detail_1` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `role_detail_2` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `is_suspended` tinyint(1) NULL DEFAULT 0,
  `activity_level` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'sedentary',
  `reset_token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `reset_token_expiry` datetime NULL DEFAULT NULL,
  `last_bot_task_id` int(11) NULL DEFAULT NULL,
  `pending_bot_result` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `equipped_title_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `line_id`(`line_id`) USING BTREE,
  INDEX `fk_users_team`(`team_id`) USING BTREE,
  INDEX `idx_user_role_team`(`role`, `team_id`) USING BTREE,
  CONSTRAINT `fk_users_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 409 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of users
-- ----------------------------
INSERT INTO `users` VALUES (402, 'U264a7c75671ebe2ac8f1e34fa8e895c3', NULL, '', NULL, '2e78cdcf30edb4b86741de45cb65ed8d:8cde033340be5f0c5d03300c1add02f4', '01f53f72e0ecc10e429944ed3e0fb1fb:c7e2b3f61a63838091a2d9fca2ac8230', '0bf5ba336cdb83d52f8a7ba32c286d7f:379c68e815fa8972ac0119369d971c2f', '17ed3d9d32a9b5b2d78594f1b92f09f6:3931bd28b1a88d123a68a99eb5f4a34c', '7b4bda077d5609325f53a990a5c2da4c:abab19291110805fdca12630df89d2f3', '1998-04-23', 'admin', '59dede13c99549024b12030d8bebbc87:7245ff260d528d75b30c5484c659589c', NULL, 'https://profile.line-scdn.net/0hwSLDJsCzKHxhPTf1wEVWQhFtKxZCTHFuHg5uGQBqcURUCWkiSV03TlY-cRhYC2YpGF43SAFvI0pDRRp4KzMlGFw1CRYFdGhqKCQQUSdmdyg8dy8oFCMJaiBpExJdSTxsLjkFeAZcCEkJawFfEz08ZBFBCCpfWGh9JGpEKmQPRv8OP18pTFpvGlw1dU3U', NULL, NULL, '1ba66a3dc9a074b9b5f6ec55723356d1:ea5ef271d65f33b4a2a232f3cbcd12ee39de42adac6e72d9ecf0ecae2168d97f9d2595b85ab8102eefd0011916e12b768d705a1c8b2c6db2ec48fe8fc4fbe23c', NULL, 'บุคลากรโรงพยาบาล', 10.00, 10, '2026-05-15 13:32:44', 'สารสนเทศ', 'เจ้าหน้าที่สารสนเทศ', 0, 'sedentary', NULL, NULL, NULL, NULL, NULL);
INSERT INTO `users` VALUES (406, 'Uf8d6cba7ca359f5b7e5f10454491fb9c', NULL, '', NULL, 'cb0ff6cb5eb279e225048f5b63f97444:4c0dd0386f951180bae4af8dae990c55', 'b3564f1930b90c5b80032b8c078ededc:bbe63dfa90fd8701d4dd821258dd6add84b8763a720c96602ee9fcd7491da7d5', '7416b68e573d20fcec16ce489a283c49:dc21d9d68c67639ef26df406ffbe4220', 'f46b710df9e9a3afb022447aa156d9b6:aa55de31123b3a9bfbeb1a2e5ae2450f', '020047537ee2b3cfaf3967ac2309f8bd:0b57411b66f6268b2a827d3e5462837e', '1994-01-08', 'admin', '2c7fec32a73c30f1e067f377e3ca1f65:1b7b33180f427d4dccaa072956fb3d7a', NULL, 'https://profile.line-scdn.net/0h7clkE7TCaExBEnZ-2ckWcjFCayZiYzFeb3chLCdCNS8scHoSb3YhL3AaNnt8JSlJOHUvLHQQMnRjUHdkaiFVcyh1dywUXk5IBXEmbgBHdRk6J1keagNXfw9yRDc1f1kSM2huYilFSx0IVn1fLhxPXSoTbB8hQ19SCUUEGkQgBs8uEB8ZbHUvKnwaNX30', 'a69617e1d1dec82910d844919ea2b89f:50e128053f1d2d79dcea26cb81f2048e', '03211d839177e18856e0db69e459c067:2fd9e8e1858c036cfa03acc82be9e80b', 'f2e682a955affafabf4ef75c1993e07f:32ab6ad2f4aab7b3aa61cb7a32db0e51a3af15e439dab6eb86c686f2cda4744de2a8bb49ffee23ed98a94f22391171ed79d7ba6c39d9c5bb9c8d19ce8ca83158', 'ลดน้ำหนัก', 'บุคลากรโรงพยาบาล', 0.00, 0, '2026-06-08 09:07:02', 'สร้างเสริมสุขภาพ', 'เจ้าหน้าที่สร้างเสริมสุขภาพ', 0, 'sedentary', NULL, NULL, NULL, NULL, NULL);
INSERT INTO `users` VALUES (407, 'U6774e9864501bba38206ce9fabd2628b', NULL, '', NULL, '37f9d4beabb7991f123ef3db77daa719:2c7964b8608a0f3190d41efacfe3ca67', '1e655fb9868348c797c7e28890dd55e8:a3efa9e8390c998b81f2adabfaec4a4e', '9e2025f2fc72bc9b9566292cb11053f3:6785cfc56ae2afd173622c14c1e2508b', 'f1013bbaf7e979559ec86bb20c6b0191:f9ee9773e8758387209f3c1fb4c6b900', 'bb9320002526340176ce28c01a9d7b95:895c4355038cf2d4a40abeedfc045523', '1988-03-04', 'admin', '22eb7ab999642b55ef05d88a284098ac:2a400bdeec1f597d06a1a430f0de00e7', NULL, 'https://profile.line-scdn.net/0hkwQLP_i4NFh8NSpBe61KZgxlNzJfRG1KAFZ6axw9bG1GAXIOAFN9bBpmYj1JDSELUlMubhpiP2leZQtIEQ8gOhJvLAYgcCsLLhMvRwxzDCE1BiVoGVYJXEtBDW8SbR1qPiQiYRNhHQM3VTVFNi4CbRZqdj9AAAoJB2JYDnkHWtsTN0MNUVJzPkE9aWnJ', '88245364f83e9741c899196ca4b6adbb:8039d2ea761ed5bbaf236c0a79688fbf', 'd230e7c28c7c94b35510e461a0b095f9:11022fa587561fc1fc07b16c65dbc987', '49cb6854586e30244ec4efd226e4f1e3:7584124a6fcfb3a7533c3f18bb03fadb7366cfbb77b42726ed073d2c820ff49b45170e39ce26cdfe1fe87fbf0d702baed1752649cfa835c4816236833466e566', 'ลดน้ำหนัก', 'บุคลากรโรงพยาบาล', 0.00, 0, '2026-06-08 10:15:03', 'อาชีวอนามัย', 'นักวิชาการสาธารณสุข', 0, 'sedentary', NULL, NULL, NULL, NULL, NULL);
INSERT INTO `users` VALUES (408, 'U7e1d651b0b6c4883a67dcb215e2e0af5', NULL, '', NULL, '0adf04194a66a96d672068b04641bfd7:507c306a2c344c248786e29068dc1ed9', 'ed7afef4254e27b657ae3e9136bf0b02:835be66b4692c3d8aff294b88241ce69', '492c82df390d1973f921dab2901e6fee:2a05cc10e1fcc8dba4bba7a767c31e2e', 'dd14262e81a236ab22dee34ebbdb2ab8:5c61ffbb7224173ad7a3b4ed34cda5bd', 'ed603de20e5094cac432bc21e19792ba:5a8cfba72c6168190edbb408903b9cae', '1989-04-22', 'admin', 'd9526f8492f25733ce806e182080fc6c:7d476aba778f551a15d21f30a8c9ac81', '', 'https://profile.line-scdn.net/0hiIavmD4GNmZMDyoIc0tIWDxfNQxvfm90Zjx5A34LbFF0bHA1aT0sCH1aOwQmbCU5Z2x4BC1fbFZuZAcsPDEvWB1uYBIuNyN5Yx0SYQJTCAo6bStqBxEsWw11NDcjYHVuKBkrZQNzOx1xYRlKNGEtayxSayozXAU4M1haMEk9WOUjDUEzYWhxAHEHa1f5', '0484a8c8761170634e83bd8405abc976:24c77873881785e0a8d0dc6f22afd102', '942f03b4b02d4191c6322637203d7a45:f2453b29191a0d1a57cc3dbdb73077ea', '32f6174e48e4cd912d1cae586269da1d:b4ac4e8550d3452240dd1ff6c64d86737e462df1ca4dc4c5311ec0226a74fd9af65a780cb1c8db9609f2e737509d3ee139138c1bf5f00ed51ffdc7d466a3055c', 'ลดน้ำหนัก', 'บุคลากรโรงพยาบาล', 0.00, 0, '2026-06-08 12:24:06', 'เวชปฏิบัติทั่วไปและปฐมภูมิ', 'พยาบาลวิชาชีพ', 0, 'sedentary', NULL, NULL, NULL, NULL, NULL);

SET FOREIGN_KEY_CHECKS = 1;
