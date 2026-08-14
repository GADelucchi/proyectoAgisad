-- 020: "Particular / Sin cobertura" dejaba de ser una obra social del catálogo.
-- La ausencia de cobertura se representa con pacientes.id_obra_social = NULL.

UPDATE pacientes p
INNER JOIN obras_sociales os ON os.id_obra_social = p.id_obra_social
SET p.id_obra_social = NULL,
    p.nro_obra_social = NULL
WHERE os.nombre = 'Particular / Sin cobertura';

DELETE FROM obras_sociales WHERE nombre = 'Particular / Sin cobertura';
