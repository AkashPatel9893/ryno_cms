import Image from "next/image";

export function LoginBrand() {
  return (
    <aside className="login-brand" aria-label="Ryno operations">
      <Image
        className="login-brand-logo"
        src="/ryno-logo.png"
        width={144}
        height={66}
        alt="Ryno mobility"
        priority
      />
      <div className="login-brand-content">
        <span className="login-brand-eyebrow">
          <span aria-hidden="true" /> Ryno operations
        </span>
        <h2>
          Every delivery
          <br />
          <span>counts.</span>
        </h2>
        <p>One place to keep your last-mile operations moving.</p>
        <div className="login-artwork">
          <Image
            src="/delivery-scooter.png"
            width={800}
            height={656}
            alt=""
            priority
          />
        </div>
      </div>
      <div className="login-brand-footer">
        <span>Bengaluru, India</span>
        <span>Built for the last mile</span>
      </div>
    </aside>
  );
}
