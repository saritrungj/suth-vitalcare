-- Remove the ฉายา/titles gamification feature (2026-06-26)
DROP TABLE IF EXISTS `user_titles`;
DROP TABLE IF EXISTS `gamification_titles`;
ALTER TABLE `users` DROP COLUMN `equipped_title_id`;
