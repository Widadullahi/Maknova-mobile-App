CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type ENUM('direct', 'group') NOT NULL DEFAULT 'direct',
  estate_id BIGINT UNSIGNED NULL,
  title VARCHAR(190) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY conversations_estate_id_index (estate_id),
  CONSTRAINT conversations_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE SET NULL,
  CONSTRAINT conversations_created_by_foreign
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  last_read_at TIMESTAMP NULL,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id),
  KEY conversation_participants_user_id_index (user_id),
  CONSTRAINT conversation_participants_conversation_id_foreign
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE,
  CONSTRAINT conversation_participants_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_user_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY messages_conversation_id_created_at_index (conversation_id, created_at),
  CONSTRAINT messages_conversation_id_foreign
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE,
  CONSTRAINT messages_sender_user_id_foreign
    FOREIGN KEY (sender_user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Community groups are fixed, auto-membership channels ("All Residents", "Estate
-- Managers", "Security Team", "Maintenance") scoped to one estate. Membership is
-- computed from role + estate assignment at request time (see scope.py) rather
-- than stored, so there is no separate membership table to keep in sync.
CREATE TABLE IF NOT EXISTS community_group_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NOT NULL,
  group_key ENUM('all_residents', 'estate_managers', 'security_team', 'maintenance') NOT NULL,
  sender_user_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY community_group_messages_scope_index (estate_id, group_key, created_at),
  CONSTRAINT community_group_messages_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE CASCADE,
  CONSTRAINT community_group_messages_sender_user_id_foreign
    FOREIGN KEY (sender_user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  title VARCHAR(190) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'general',
  pinned TINYINT(1) NOT NULL DEFAULT 0,
  event_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY announcements_estate_id_index (estate_id),
  KEY announcements_pinned_index (pinned),
  CONSTRAINT announcements_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE CASCADE,
  CONSTRAINT announcements_created_by_foreign
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcement_acknowledgements (
  announcement_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id, user_id),
  CONSTRAINT announcement_acks_announcement_id_foreign
    FOREIGN KEY (announcement_id) REFERENCES announcements(id)
    ON DELETE CASCADE,
  CONSTRAINT announcement_acks_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL,
  platform VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY push_tokens_token_unique (token),
  KEY push_tokens_user_id_index (user_id),
  CONSTRAINT push_tokens_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
