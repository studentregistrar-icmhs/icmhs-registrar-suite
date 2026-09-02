import "./deferments.css";

export const metadata = {
  title: "ICMHS Deferments — Registrar Suite",
  description: "Imperial College of Medical and Health Sciences — Office of Registrar of Students"
};

export default function DefermentsLayout({ children }) {
  return (
    <div className="deferments-scope">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
      />
      <div className="brandbar" />
      {children}
    </div>
  );
}
