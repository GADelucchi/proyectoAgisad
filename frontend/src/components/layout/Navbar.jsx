import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "../ui/ThemeToggle";
import { useAuth } from "../../context/AuthContext";
import { LogOut, Bell } from "lucide-react";
import "./Navbar.css";

export default function Navbar({ titulo, subtitulo, acciones }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="navbar">
      <div className="navbar-left">
        <Link to="/" className="navbar-brand">
          <span className="navbar-brand-wordmark">Agisad</span>
        </Link>
        {titulo && (
          <div className="navbar-title">
            <span className="navbar-title-text">{titulo}</span>
            {subtitulo && <span className="navbar-subtitle">{subtitulo}</span>}
          </div>
        )}
      </div>

      <div className="navbar-right">
        {acciones}
        <ThemeToggle />
        {usuario && (
          <>
            <button className="navbar-icon-btn" title="Notificaciones">
              <Bell size={18} />
            </button>
            <button
              className="navbar-icon-btn"
              title="Cerrar sesión"
              onClick={handleLogout}
            >
              <LogOut size={18} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
