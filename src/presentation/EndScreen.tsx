/** Despedida infantil sin navegación hacia más vídeos. Se abre en lugar de Disney+. */
export function EndScreen() {
  return <main className="end-screen">
    <div className="end-stars" aria-hidden="true">✦ <span>✧</span> ✦</div>
    <div className="moon-friend" aria-hidden="true"><div className="moon-eyes"><i/><i/></div><div className="moon-smile"/><span className="cheek left"/><span className="cheek right"/></div>
    <p className="end-kicker">¡QUÉ BIEN LO HEMOS PASADO!</p>
    <h1>Por hoy, la tele<br/>ha terminado.</h1>
    <p className="end-message">Los dibujos descansan.<br/>Ahora te toca vivir tu aventura.</p>
    <div className="offline-ideas"><span>🧸 Jugar</span><span>🎨 Dibujar</span><span>📖 Un cuento</span></div>
    <p className="end-goodbye">¡Hasta la próxima!</p>
  </main>;
}
