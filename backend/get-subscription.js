const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: 'Unafacil1my!',
      database: 'clinica_db'
    });
    
    const [rows] = await conn.execute(
      'SELECT u.email, u.username, m.id_membresia, m.plan, m.estado, m.fecha_inicio, m.fecha_fin, m.monto_mensual, m.auto_renueva FROM usuarios u LEFT JOIN membresias m ON u.id_usuario = m.id_usuario WHERE u.email = ? ORDER BY m.creado_en DESC LIMIT 1', 
      ['gad@elpsiquiatra.ar']
    );
    
    const result = rows[0] || { error: 'Usuario no encontrado' };
    fs.writeFileSync('/tmp/subscription_result.json', JSON.stringify(result, null, 2));
    
    await conn.end();
  } catch(e) {
    fs.writeFileSync('/tmp/subscription_result.json', JSON.stringify({ error: e.message }));
  }
})();
