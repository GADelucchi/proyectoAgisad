import { Link } from 'react-router-dom'
import './LegalPages.css'

export default function PrivacidadPage() {
  return (
    <div className="legal-page">
      <h1>Política de privacidad</h1>
      <p className="legal-updated">Última actualización: agosto de 2026</p>

      <p>
        Esta política explica qué datos personales trata Agisad, con qué finalidad y qué
        derechos tenés sobre ellos, conforme a la Ley 25.326 de Protección de Datos Personales
        de la República Argentina y su normativa complementaria.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <p>
        Gastón Alejo Delucchi, CUIT 20-40568729-2, con domicilio en La Plata, provincia de
        Buenos Aires. Contacto: <a href="mailto:soporte@agisad.ar">soporte@agisad.ar</a>.
      </p>

      <h2>2. Doble rol: responsable y encargado</h2>
      <p>
        Agisad actúa como <strong>responsable</strong> respecto de los datos de las cuentas
        que contratan el servicio (profesionales, clínicas y su personal).
      </p>
      <p>
        Respecto de los datos de los pacientes cargados por un profesional, Agisad actúa como{' '}
        <strong>encargado del tratamiento</strong>: los procesa por cuenta y orden del
        profesional o la institución, que es quien determina la finalidad y conserva la
        responsabilidad sobre la historia clínica. Agisad no usa esos datos para fines
        propios ni los cede a terceros.
      </p>

      <h2>3. Datos que tratamos</h2>
      <ul>
        <li><strong>De cuentas profesionales:</strong> nombre, email, teléfono, DNI, matrícula, especialidad, datos de facturación y registros de acceso.</li>
        <li><strong>De pacientes:</strong> nombre, DNI, fecha de nacimiento, email, teléfono, cobertura médica, turnos, solicitudes de receta y notas administrativas cargadas por el profesional.</li>
        <li><strong>Técnicos:</strong> dirección IP, fecha y hora de acceso y acciones sobre los turnos, con fines de seguridad y auditoría.</li>
      </ul>

      <h2>4. Datos sensibles</h2>
      <p>
        Los datos referidos a la salud son datos sensibles en los términos del art. 7 de la
        Ley 25.326. Solo pueden ser cargados y consultados por profesionales de la salud y
        personal autorizado, sujetos al secreto profesional, y únicamente en el marco de la
        atención del paciente. El acceso está restringido por rol y cada modificación queda
        registrada.
      </p>

      <h2>5. Finalidad</h2>
      <ul>
        <li>Prestar el servicio de gestión de turnos, recetas y pacientes.</li>
        <li>Enviar recordatorios, confirmaciones y notificaciones vinculadas a los turnos.</li>
        <li>Autenticar usuarios y proteger las cuentas.</li>
        <li>Facturar y administrar la relación comercial.</li>
      </ul>
      <p>No usamos los datos para publicidad ni los vendemos a terceros.</p>

      <h2>6. Base legal</h2>
      <p>
        El tratamiento se funda en el consentimiento del titular, en la ejecución del contrato
        de servicio y, para los datos de salud, en el art. 8 de la Ley 25.326, que habilita a
        los establecimientos sanitarios y a los profesionales vinculados a la salud a tratar
        datos relativos a la salud de sus pacientes respetando el secreto profesional.
      </p>

      <h2>7. Conservación</h2>
      <p>
        Conservamos los datos mientras la cuenta esté activa y durante los plazos que exija la
        normativa aplicable. Al cerrarse una cuenta, el profesional puede solicitar la
        exportación de su información antes de la eliminación.
      </p>

      <h2>8. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas razonables: conexión cifrada (HTTPS),
        contraseñas almacenadas con hash, autenticación por token, control de acceso por rol,
        aislamiento de los datos de cada profesional y registro de auditoría de los cambios de
        estado de los turnos.
      </p>

      <h2>9. Terceros que intervienen</h2>
      <p>
        Para prestar el servicio utilizamos proveedores de infraestructura y de envío de
        correo electrónico, que acceden a los datos únicamente en la medida necesaria y bajo
        obligación de confidencialidad.
      </p>

      <h2>10. Tus derechos</h2>
      <p>
        Podés ejercer los derechos de acceso, rectificación, actualización y supresión de tus
        datos escribiendo a <a href="mailto:soporte@agisad.ar">soporte@agisad.ar</a>. El
        titular de los datos tiene derecho a solicitar el acceso en forma gratuita a intervalos
        no inferiores a seis meses, salvo interés legítimo (art. 14, inc. 3 de la Ley 25.326).
      </p>
      <p>
        Si sos paciente y tus datos fueron cargados por un profesional, dirigí tu pedido a ese
        profesional; si no obtenés respuesta, escribinos y lo canalizamos.
      </p>

      <h2>11. Autoridad de control</h2>
      <p>
        La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de
        la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan
        quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes
        en materia de protección de datos personales.
      </p>

      <h2>12. Cambios</h2>
      <p>
        Si modificamos esta política publicaremos la nueva versión en esta misma página y
        actualizaremos la fecha del encabezado.
      </p>

      <p>
        Ver también los <Link to="/terminos">términos y condiciones</Link>.
      </p>
    </div>
  )
}
