import logo from "../assets/reactstream-logo-transparent.png";

export default function HomePage() {
  return (
    <section className="home-page hero-stage">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-sweep hero-sweep-top" aria-hidden="true" />
      <div className="hero-sweep hero-sweep-bottom" aria-hidden="true" />
      <div className="hero-sweep hero-sweep-left" aria-hidden="true" />

      <span className="hero-corner hero-corner-tl" aria-hidden="true" />
      <span className="hero-corner hero-corner-tr" aria-hidden="true" />
      <span className="hero-corner hero-corner-bl" aria-hidden="true" />
      <span className="hero-corner hero-corner-br" aria-hidden="true" />

      <div className="hero-copy">
        <span>MÁS</span>
        <span>QUE HERRAMIENTAS,</span>
        <span>ES TU LIVE</span>
        <span>EN OTRO NIVEL.</span>
      </div>

      <div className="hero-brand">
        <img src={logo} alt="ReactStream" />
      </div>

      <div className="hero-values">
        <span className="hero-values-line" />
        <span>CREATE</span>
        <span>INTERACT</span>
        <span>ENGAGE</span>
        <span>GROW</span>
      </div>

      <div className="hero-bottom">
        <div className="hero-bottom-status">
          <span className="hero-status-dot" />
          <span>Tu live, más interactivo.</span>
        </div>
        <div className="hero-bottom-version">
          REACTSTREAM APP&nbsp;&nbsp; v1.0.0
        </div>
      </div>
    </section>
  );
}
