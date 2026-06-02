import { useState } from 'react'

function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.58 5.62A11.2 11.2 0 0 1 12 5.25C18 5.25 21.75 12 21.75 12a18.4 18.4 0 0 1-2.9 3.93" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.53 7.09C4.88 8.9 2.25 12 2.25 12S6 18.75 12 18.75c1.12 0 2.17-.18 3.15-.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.88 10.08A3.25 3.25 0 0 0 12 14.75c.55 0 1.06-.13 1.52-.36" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder = '••••••••',
  className = 'form-input',
  autoComplete = 'current-password',
  ...props
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-field">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        className={`${className} password-input`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        {...props}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible(prev => !prev)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon /> : <EyeOpenIcon />}
      </button>
    </div>
  )
}