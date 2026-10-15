import { useState } from 'react';
import { api } from '../utils/api.js';

export default function AdminAccess({ session, busy, run, onAuthenticated }) {
  const [stage, setStage] = useState('credentials');
  const [challenge, setChallenge] = useState(null);
  const [message, setMessage] = useState('');
  function restart() { setStage('credentials'); setChallenge(null); setMessage(''); }
  async function submit(event) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    run(async () => {
      if (input.confirmPassword !== undefined && input.confirmPassword !== input.password) throw new Error('Las contraseñas no coinciden.');
      delete input.confirmPassword;
      const action = stage === 'credentials' ? session.needsSetup ? 'setup' : 'login'
        : { enroll: 'enroll-email', verify: 'verify', forgot: 'forgot-password', reset: 'reset-password' }[stage];
      const result = await api(`admin/${action}`, { method: 'POST', body: JSON.stringify({ ...input, challengeId: challenge }) });
      if (stage === 'verify') { restart(); await onAuthenticated(); }
      else if (stage === 'reset') { restart(); setMessage('Contraseña actualizada. Ingresá con la nueva contraseña y el código que recibirás por correo.'); }
      else if (stage === 'forgot') { setChallenge(result.challengeId); setMessage(result.message); setStage('reset'); }
      else {
        setChallenge(result.challengeId);
        setStage(result.enrollmentRequired ? 'enroll' : 'verify');
        setMessage(result.enrollmentRequired ? 'Para proteger tu cuenta existente, vinculá y verificá tu correo.' : 'Te enviamos un código de 8 dígitos. Vence en 10 minutos y admite hasta 5 intentos.');
      }
    });
  }
  const titles = {
    credentials: session.needsSetup ? 'Creá tu administrador' : 'Ingresar al panel',
    enroll: 'Vincular correo', verify: 'Verificá tu correo', forgot: 'Recuperar contraseña', reset: 'Elegí una nueva contraseña',
  };
  return <section className="admin-card admin-login">
    <h2>{titles[stage]}</h2>
    {message && <p role="status">{message}</p>}
    {session.mailReady === false && <p role="alert">Falta configurar el envío de correo en el servidor. El catálogo público sigue disponible; el acceso administrativo requiere verificación.</p>}
    <form key={stage} onSubmit={submit}>
      <fieldset disabled={busy} className="admin-auth-fields">
        {stage === 'credentials' && <>
          {session.needsSetup && <><p>Ingresá el código de instalación de la terminal. La cuenta se activa después de verificar tu correo.</p>
            <label>Código de instalación<input name="token" required autoComplete="off" maxLength={100} /></label>
            <label>Correo del administrador<input type="email" name="email" required autoComplete="email" maxLength={254} /></label></>}
          <label>Usuario<input name="username" required minLength={3} maxLength={80} autoComplete="username" /></label>
          <label>Contraseña<input type="password" name="password" required minLength={session.needsSetup ? 12 : 1} maxLength={200} autoComplete={session.needsSetup ? 'new-password' : 'current-password'} /></label>
          {session.needsSetup && <label>Repetir contraseña<input type="password" name="confirmPassword" required minLength={12} maxLength={200} autoComplete="new-password" /></label>}
        </>}
        {(stage === 'enroll' || stage === 'forgot') && <label>Correo del administrador<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>}
        {(stage === 'verify' || stage === 'reset') && <label>Código recibido por correo<input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" minLength={8} maxLength={8} required autoFocus /></label>}
        {stage === 'reset' && <>
          <label>Nueva contraseña<input name="password" type="password" minLength={12} maxLength={200} autoComplete="new-password" required /></label>
          <label>Repetir contraseña<input name="confirmPassword" type="password" minLength={12} maxLength={200} autoComplete="new-password" required /></label>
        </>}
        <button disabled={busy || (session.mailReady === false && !['verify', 'reset'].includes(stage))}>
          {busy ? 'Procesando…' : stage === 'verify' ? 'Verificar e ingresar' : stage === 'reset' ? 'Guardar contraseña' : stage === 'credentials' ? 'Continuar' : 'Enviar código'}
        </button>
      </fieldset>
    </form>
    {stage === 'credentials' && !session.needsSetup && <button type="button" className="admin-secondary" disabled={busy} onClick={() => { setStage('forgot'); setMessage(''); }}>Olvidé mi contraseña</button>}
    {stage !== 'credentials' && <button type="button" className="admin-secondary" disabled={busy} onClick={restart}>Volver al ingreso</button>}
    {stage === 'verify' && <small>Si no llegó, revisá Spam. Para solicitar otro código, volvé al ingreso. Los envíos tienen un límite para proteger tu cuenta.</small>}
  </section>;
}

export function AdminPassword({ busy, run, onChanged }) {
  return <details className="admin-card admin-password"><summary>Seguridad de la cuenta · cambiar contraseña</summary>
    <form onSubmit={event => {
      event.preventDefault();
      const input = Object.fromEntries(new FormData(event.currentTarget));
      run(async () => {
        if (input.password !== input.confirmPassword) throw new Error('Las contraseñas no coinciden.');
        delete input.confirmPassword;
        await api('admin/change-password', { method: 'POST', body: JSON.stringify(input) });
        await onChanged();
      });
    }}>
      <p>Al cambiar la contraseña se cierran las sesiones activas. Vas a tener que ingresar nuevamente.</p>
      <div className="admin-form-grid">
        <label>Contraseña actual<input name="currentPassword" type="password" autoComplete="current-password" maxLength={200} required /></label>
        <label>Nueva contraseña<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={200} required /></label>
        <label>Repetir contraseña<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={200} required /></label>
      </div>
      <button disabled={busy}>Cambiar contraseña y cerrar sesiones</button>
    </form>
  </details>;
}
