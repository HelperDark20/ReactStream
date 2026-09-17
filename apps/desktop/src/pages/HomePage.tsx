import background from "../assets/reactstream-background.svg";
import logo from "../assets/reactstream-home-logo.svg";

export default function HomePage() {
  return (
    <section className="home-page home-artwork-page" aria-label="ReactStream">
      <img
        className="home-background-svg"
        src={background}
        alt=""
        draggable={false}
      />
      <img
        className="home-central-logo"
        src={logo}
        alt="ReactStream"
        draggable={false}
      />
    </section>
  );
}
