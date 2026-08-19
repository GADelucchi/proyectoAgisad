import { Link } from 'react-router-dom'
import './LegalPages.css'

export default function TerminosPage() {
  return (
    <div className="legal-page">
      <h1>Términos y condiciones</h1>
      <p className="legal-updated">Última actualización: agosto de 2026</p>

      <p>
        Estos términos regulan el uso de Agisad, provisto por Gastón Alejo Delucchi,
        CUIT 20-40568729-2, con domicilio en La Plata, provincia de Buenos Aires, Argentina.
        Al crear una cuenta aceptás estas condiciones.
      </p>

      <h2>1. Qué es el servicio</h2>
      <p>
        Agisad es un software de gestión administrativa para consultorios y clínicas: agenda de
        turnos, solicitudes de recetas, base de pacientes, recordatorios y administración de
        equipo por rol. Se presta bajo la modalidad de software como servicio, accesible por
        internet.
      </p>
      <p>
        Agisad <strong>no presta servicios de salud</strong>, no emite diagnósticos ni sustituye
        el criterio del profesional. La validez legal de una receta, la corrección de una
        historia clínica y toda decisión clínica son responsabilidad exclusiva del profesional
        que utiliza el sistema.
      </p>

      <h2>2. Cuentas y uso</h2>
      <ul>
        <li>Los datos de registro deben ser verdaderos y estar actualizados.</li>
        <li>Cada usuario es responsable de la confidencialidad de su contraseña y de la actividad realizada con su cuenta.</li>
        <li>Los profesionales son responsables de los accesos que otorguen a asistentes y personal.</li>
        <li>Está prohibido usar el servicio para fines ilícitos, vulnerar su seguridad o acceder a datos de terceros sin autorización.</li>
      </ul>

      <h2>3. Prueba gratuita y planes</h2>
      <p>
        La cuenta incluye un período de prueba de 30 días sin cargo y sin necesidad de tarjeta
        de crédito. Finalizada la prueba, para seguir usando el servicio hay que contratar
        alguno de los planes vigentes, cuyos precios y prestaciones se publican en la página de
        inicio. Los precios están expresados en pesos argentinos e incluyen los impuestos
        aplicables.
      </p>

      <h2>4. Pagos, modificaciones y baja</h2>
      <ul>
        <li>La facturación es mensual y por adelantado.</li>
        <li>Podemos actualizar los precios avisando con al menos 30 días de anticipación por email.</li>
        <li>Podés dar de baja el servicio en cualquier momento, sin penalidad. La baja rige al final del período ya abonado.</li>
        <li>La falta de pago habilita la suspensión del acceso previo aviso.</li>
      </ul>

      <h2>5. Datos y confidencialidad</h2>
      <p>
        Los datos cargados por cada profesional le pertenecen. Agisad los trata como encargado
        del tratamiento, con la sola finalidad de prestar el servicio, según se detalla en la{' '}
        <Link to="/privacidad">política de privacidad</Link>. Antes de dar de baja una cuenta
        podés solicitar la exportación de tu información.
      </p>

      <h2>6. Disponibilidad</h2>
      <p>
        Procuramos que el servicio esté disponible de forma continua, pero puede haber
        interrupciones por mantenimiento, actualizaciones o fallas de terceros proveedores. Las
        tareas programadas se avisan con anticipación cuando es posible.
      </p>

      <h2>7. Responsabilidad</h2>
      <p>
        El servicio se presta en el estado en que se encuentra. En la medida permitida por la
        ley, no respondemos por daños indirectos, lucro cesante ni pérdida de oportunidades
        comerciales. Nada en estos términos limita los derechos que la Ley 24.240 de Defensa
        del Consumidor reconoce a los usuarios.
      </p>

      <h2>8. Propiedad intelectual</h2>
      <p>
        El software, la marca Agisad y sus contenidos son propiedad de su titular. La
        contratación otorga una licencia de uso limitada, no exclusiva e intransferible,
        mientras el plan esté vigente.
      </p>

      <h2>9. Cambios en los términos</h2>
      <p>
        Podemos modificar estos términos. Los cambios relevantes se comunican por email o
        dentro del sistema con anticipación razonable. El uso posterior implica aceptación.
      </p>

      <h2>10. Ley aplicable y jurisdicción</h2>
      <p>
        Estos términos se rigen por las leyes de la República Argentina. Ante cualquier
        controversia serán competentes los tribunales ordinarios de la ciudad de La Plata,
        provincia de Buenos Aires, sin perjuicio de la opción del consumidor de acudir al
        tribunal de su domicilio.
      </p>

      <p>
        Consultas: <a href="mailto:soporte@agisad.ar">soporte@agisad.ar</a>.
      </p>
    </div>
  )
}
