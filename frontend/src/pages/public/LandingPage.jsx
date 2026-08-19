import { Link } from "react-router-dom";
import "./LandingPage.css";

const FEATURES = [
  {
    icon: "📅",
    title: "Agenda online 24/7",
    desc: "Tus pacientes sacan turno desde el celular en cualquier momento, sin llamar. Vos recibís la notificación al instante.",
    tag: "Sin límite de reservas →",
  },
  {
    icon: "💬",
    title: "Recordatorios automáticos",
    desc: "Mensajes automáticos 24 y 2 horas antes del turno, con confirmación en un clic. Vos relajate: de recordarlo se encarga Agisad.",
    tag: "Recordatorios por email →",
  },
  {
    icon: "🏥",
    title: "Panel multi-rol",
    desc: "Gestioná agendas de médicos y asistentes desde un solo lugar, con permisos por rol y visibilidad controlada.",
    tag: "Roles y permisos →",
  },
  {
    icon: "📋",
    title: "Base clínica de pacientes",
    desc: "Ficha completa del paciente siempre disponible: contacto, cobertura, historial y trazabilidad de cambios.",
    tag: "Seguro y auditable →",
  },
  {
    icon: "🔒",
    title: "Seguridad y control",
    desc: "Autenticación con JWT, control de acceso por rol y aislamiento de datos para cada profesional.",
    tag: "Seguridad activa →",
  },
  {
    icon: "🦾",
    title: "Automatización operativa",
    desc: "Menos tareas manuales en recepción: confirmaciones, cancelaciones y gestión de disponibilidad más simple.",
    tag: "Más tiempo para atender →",
  },
];

const PLANS = [
  {
    name: "Inicial",
    amount: "29.999",
    period: "/mes",
    desc: "Para profesionales independientes que recién arrancan",
    cta: "Probar 30 días gratis",
    featured: false,
    items: [
      { ok: true, text: "Solicitud de recetas" },
      { ok: true, text: "Verificación OTP" },
      { ok: false, text: "Módulo de turnos" },
      { ok: false, text: "Creación de clínicas" },
      { ok: false, text: "Solicitud de turnos automatizada" },
      { ok: false, text: "Recordatorios automáticos" },
      { ok: false, text: "Gestión de asistentes" },
    ],
  },
  {
    name: "Medio",
    amount: "49.999",
    period: "/mes",
    desc: "Para quienes necesitan automatizaciones completas sin complicaciones",
    cta: "Probar 30 días gratis",
    featured: true,
    items: [
      { ok: true, text: "Plan Inicial" },
      { ok: true, text: "Hasta 2 clínicas" },
      { ok: true, text: "Hasta 350 turnos automáticos / mes" },
      { ok: true, text: "Recordatorios automáticos" },
      { ok: true, text: "Cancelación online" },
      { ok: false, text: "Creación de asistentes" },
    ],
  },
  {
    name: "Profesional",
    amount: "74.999",
    period: "/mes",
    desc: "Para profesionales y clínicas que necesitan más funcionalidades",
    cta: "Probar 30 días gratis",
    featured: false,
    items: [
      { ok: true, text: "Plan Inicial" },
      { ok: true, text: "Turnos ilimitados" },
      { ok: true, text: "Hasta 5 clínicas" },
      { ok: true, text: "Hasta 2 asistentes" },
      { ok: true, text: "Reportes y estadísticas" },
      { ok: true, text: "Soporte prioritario" },
    ],
  },
  {
    name: "Empresarial",
    amount: "119.999",
    period: "/mes",
    desc: "Para clínicas con múltiples especialidades y alta demanda",
    cta: "Hablar con ventas →",
    featured: false,
    items: [
      { ok: true, text: "Solicitud de recetas" },
      { ok: true, text: "Turnos ilimitados" },
      { ok: true, text: "Hasta 5 asistentes" },
      { ok: true, text: "Reportes y estadísticas" },
      { ok: true, text: "Soporte prioritario" },
      { ok: true, text: "Módulo rehabilitación" },
    ],
  },
];

const TESTIMONIALS = [
  {
    stars: "★★★★★",
    text: "Desde que uso Agisad, paso menos tiempo respondiendo mensajes de WhatsApp. La autogestión ordena toda la agenda.",
    initials: "GAD",
    name: "Dr. Gustavo Alfredo Delucchi",
    role: "Psiquiatra · La Plata",
  },
  {
    stars: "★★★★★",
    text: "La autogestión de agenda, pacientes y recetas me simplificó el uso diario.",
    initials: "FM",
    name: "Dra. Fabiana Marmissolle",
    role: "Oncóloga · La Plata",
  },
];

export default function LandingPage() {
  return (
    <div className="tm-landing">
      <section className="tm-hero">
        <div className="container">
          <div className="tm-hero-inner">
            <div>
              <div className="tm-hero-eyebrow">
                <span className="dot">Nuevo</span>
                Recordatorios automáticos por email
              </div>
              <h1>
                Menos tareas manuales.
                <br />
                Más{" "}
                <span className="hi">
                  <span className="wave">pacientes</span>
                </span>
                <br />
                atendidos.
              </h1>
              <p className="tm-hero-sub">
                Agisad organiza turnos, recetas, pacientes y trabajo del equipo
                médico en un solo panel. Más claridad operativa, menos fricción
                diaria.
              </p>
              <div className="tm-hero-ctas">
                <Link to="/login" className="tm-btn tm-btn-primary">
                  Ingresar al sistema →
                </Link>
                <a href="#pricing" className="tm-btn tm-btn-ghost">
                  Ver planes
                </a>
              </div>
              <ul className="tm-hero-trust">
                <li>30 días de prueba gratis</li>
                <li>Sin tarjeta de crédito</li>
                <li>Cancelás cuando querés</li>
              </ul>
            </div>

            <div className="tm-hero-visual">
              <div className="tm-mockup-wrap">
                <div className="tm-stat-card">
                  <div className="tm-stat-card-num">24/7</div>
                  <div className="tm-stat-card-label">turnos online</div>
                </div>
                <div className="tm-mockup">
                  <div className="tm-mockup-topbar">
                    <div className="dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <strong>. Agisad — Agenda del día</strong>
                  </div>
                  <div className="tm-mockup-body">
                    <div className="tm-mockup-month">
                      <strong>Mayo 2026</strong>
                      <div className="tm-mockup-month-nav">
                        <button>‹</button>
                        <button>›</button>
                      </div>
                    </div>
                    <div className="tm-mockup-appts">
                      <div className="tm-mockup-appt">
                        <div className="appt-time">09:00</div>
                        <div className="appt-info">
                          <div className="appt-name">María G. Fernández</div>
                          <div className="appt-spec">
                            Traumatología · Dr. Vera
                          </div>
                        </div>
                        <span className="appt-badge">Conf.</span>
                      </div>
                      <div className="tm-mockup-appt orange">
                        <div className="appt-time orange">10:30</div>
                        <div className="appt-info">
                          <div className="appt-name">Carlos Rodríguez</div>
                          <div className="appt-spec">
                            Neurología · Dr. Iglesias
                          </div>
                        </div>
                        <span className="appt-badge pending">Pend.</span>
                      </div>
                      <div className="tm-mockup-appt green">
                        <div className="appt-time green">11:00</div>
                        <div className="appt-info">
                          <div className="appt-name">Ana Torres</div>
                          <div className="appt-spec">Fisiatría · Dra. Ruso</div>
                        </div>
                        <span className="appt-badge done">Asistió</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="tm-notif-card">
                  <div className="tm-notif-icon">✅</div>
                  <div className="tm-notif-text">
                    <strong>Turno confirmado</strong>
                    <span>Recordatorio enviado por email</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="tm-strip">
        <div className="container">
          <div className="tm-strip-inner">
            <span className="tm-strip-label">
              Pensado para el consultorio argentino
            </span>
            <div className="tm-strip-logos">
              <span className="tm-strip-logo">Obras sociales y prepagas</span>
              <span className="tm-strip-logo">Recetas digitales</span>
              <span className="tm-strip-logo">Multi-consultorio</span>
              <span className="tm-strip-logo">Soporte en español</span>
              <span className="tm-strip-logo">Precios en pesos</span>
            </div>
          </div>
        </div>
      </div>

      <section className="tm-section" id="features">
        <div className="container">
          <div className="tm-head">
            <span className="tm-label">Funcionalidades</span>
            <h2>Todo lo que necesitás para organizar tu consultorio</h2>
          </div>
          <div className="tm-features-grid">
            {FEATURES.map((f) => (
              <div className="tm-feat-card" key={f.title}>
                <div className="tm-feat-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <span className="tm-feat-tag">{f.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tm-section tm-how-section" id="how">
        <div className="container landing-cta-inner">
          <div className="tm-head">
            <span className="tm-label">Cómo funciona</span>
            <h2>En 3 pasos, tu consultorio digitalizado</h2>
          </div>
          <div className="tm-steps">
            <div className="tm-step">
              <div className="tm-step-num">1</div>
              <h3>Creá tu cuenta</h3>
              <p>
                Registrate en minutos. Configurá médicos, horarios y duración de
                turnos sin fricción.
              </p>
            </div>
            <div className="tm-step">
              <div className="tm-step-num">2</div>
              <h3>Compartí el acceso</h3>
              <p>
                Invitá asistentes y equipo médico. Cada rol ve lo que
                corresponde, con permisos reales.
              </p>
            </div>
            <div className="tm-step">
              <div className="tm-step-num">3</div>
              <h3>Agisad hace el resto</h3>
              <p>
                Recordatorios, confirmaciones y gestión de agenda centralizada
                para que te enfoques en atender.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="tm-section" id="pricing">
        <div className="container">
          <div className="tm-head">
            <span className="tm-label">Planes</span>
            <h2>Simple y sin sorpresas</h2>
            <p>
              Todos los planes incluyen 30 días de prueba gratis. Cancelás
              cuando querés.
            </p>
          </div>
          <div className="tm-pricing-grid">
            {PLANS.map((plan) => (
              <div
                className={`tm-plan-card ${plan.featured ? "featured" : ""}`}
                key={plan.name}
              >
                {plan.featured && (
                  <div className="tm-plan-badge">Más elegido</div>
                )}
                <div className="tm-plan-name">{plan.name}</div>
                <div className="tm-plan-price">
                  <span className="currency">$</span>
                  <span className="amount">{plan.amount}</span>
                  <span className="period">{plan.period}</span>
                </div>
                <p className="tm-plan-desc">{plan.desc}</p>
                <div className="tm-plan-features">
                  {plan.items.map((item) => (
                    <div className="tm-plan-feat" key={item.text}>
                      <span className={`check ${item.ok ? "" : "no"}`}>
                        {item.ok ? "✓" : "–"}
                      </span>
                      {item.text}
                    </div>
                  ))}
                </div>
                <Link
                  to="/login"
                  className={`tm-btn plan-btn ${plan.featured ? "tm-btn-teal" : "tm-btn-ghost"}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tm-section tm-testi-section" id="testimonials">
        <div className="container">
          <div className="tm-head">
            <span className="tm-label">Testimonios</span>
            <h2>Quiénes ya lo están usando</h2>
          </div>
          <div className="tm-testi-grid">
            {TESTIMONIALS.map((t) => (
              <div className="tm-testi-card" key={t.name}>
                <div className="tm-testi-stars">{t.stars}</div>
                <p className="tm-testi-text">“{t.text}”</p>
                <div className="tm-testi-author">
                  <div className="tm-testi-av">{t.initials}</div>
                  <div className="tm-testi-info">
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tm-section tm-cta-section">
        <div className="container">
          <div className="tm-cta-inner">
            <h2>Tu consultorio merece trabajar mejor</h2>
            <p>
              30 días gratis. Sin tarjeta de crédito. Cancelás cuando querés.
            </p>
            <Link to="/login" className="tm-btn tm-btn-white">
              Empezá ahora — es gratis →
            </Link>
            <p className="tm-cta-note">
              Configuración en minutos · Soporte en español · Sin permanencia
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
