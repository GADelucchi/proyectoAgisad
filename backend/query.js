const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: 'Unafacil1my!',
      database: 'clinica_db'
    });
    const [rows] = await conn.execute('SELECT u.email, u.username, u.rol, m.plan, m.estado, m.fecha_inicio, m.fecha_fin FROM usuarios u LEFT JOIN membresias m ON u.id_usuario = m.id_usuario WHERE u.email = ? ORDER BY m.creado_en DESC LIMIT 1', ['gad@elpsiquiatra.ar']);
    console.log('Suscripción del usuario gad@elpsiquiatra.ar:');
    console.log(JSON.stringify(rows[0], null, 2));
    await conn.end();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
