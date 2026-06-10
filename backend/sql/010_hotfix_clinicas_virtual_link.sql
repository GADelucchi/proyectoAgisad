-- Hotfix: permitir clinicas virtuales con link y direccion nullable
DELIMITER $$

CREATE PROCEDURE hotfix_clinicas_virtual_link()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'clinicas'
      AND COLUMN_NAME = 'direccion'
      AND IS_NULLABLE = 'NO'
  ) THEN
    ALTER TABLE clinicas
      MODIFY direccion VARCHAR(255) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'clinicas'
      AND COLUMN_NAME = 'link'
  ) THEN
    ALTER TABLE clinicas
      ADD COLUMN link VARCHAR(500) NULL AFTER direccion;
  END IF;
END$$

DELIMITER ;

CALL hotfix_clinicas_virtual_link();
DROP PROCEDURE hotfix_clinicas_virtual_link;