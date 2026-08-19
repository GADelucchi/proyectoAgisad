import './LegalPages.css'

export default function ContactoPage() {
  return (
    <div className="legal-page">
      <h1>Contacto</h1>
      <p className="legal-updated">Quién está detrás de Agisad y cómo comunicarse.</p>

      <h2>Quiénes somos</h2>
      <p>
        Agisad es un software de gestión para consultorios y clínicas desarrollado y operado
        de forma independiente por Gastón Alejo Delucchi, desarrollador de software radicado
        en La Plata, provincia de Buenos Aires, Argentina.
      </p>
      <p>
        Agisad es una herramienta administrativa: organiza turnos, recetas, pacientes y el
        trabajo del equipo. No brinda asesoramiento médico ni reemplaza el criterio profesional.
        La responsabilidad clínica de cada atención es siempre del profesional de la salud
        que usa el sistema.
      </p>

      <h2>Datos del titular</h2>
      <ul className="legal-datos">
        <li><strong>Titular</strong><span>Gastón Alejo Delucchi</span></li>
        <li><strong>CUIT</strong><span>20-40568729-2</span></li>
        <li><strong>Domicilio</strong><span>La Plata, provincia de Buenos Aires, Argentina</span></li>
        <li><strong>Email</strong><span><a href="mailto:soporte@agisad.ar">soporte@agisad.ar</a></span></li>
        <li><strong>Sitio</strong><span><a href="https://agisad.ar">agisad.ar</a></span></li>
      </ul>

      <h2>Soporte</h2>
      <p>
        Escribinos a <a href="mailto:soporte@agisad.ar">soporte@agisad.ar</a> por consultas
        sobre el servicio, problemas técnicos, facturación o para ejercer tus derechos sobre
        los datos personales. Respondemos en días hábiles.
      </p>

      <h2>Defensa del consumidor</h2>
      <p>
        Ante un reclamo podés acudir al Sistema Nacional de Arbitraje de Consumo o a la
        Dirección Nacional de Defensa del Consumidor, conforme a la Ley 24.240.
      </p>
    </div>
  )
}
