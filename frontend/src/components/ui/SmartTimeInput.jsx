import { useEffect, useState } from 'react'
import { displayTimeFrom24h, formatTimeDisplay, time24hFromDisplay } from '../../utils/smartTimeInput'

export default function SmartTimeInput({ value, onChange, className = 'form-input', id, name, placeholder = 'HH:MM' }) {
  const [draftValue, setDraftValue] = useState('')

  useEffect(() => {
    setDraftValue(displayTimeFrom24h(value))
  }, [value])

  return (
    <input
      id={id}
      name={name}
      type="text"
      className={className}
      inputMode="numeric"
      placeholder={placeholder}
      value={draftValue}
      onChange={(e) => {
        const formatted = formatTimeDisplay(e.target.value)
        setDraftValue(formatted)
        const isoValue = time24hFromDisplay(formatted)
        if (isoValue || formatted === '') {
          onChange({ target: { name, value: isoValue } })
        }
      }}
      onBlur={() => {
        const isoValue = time24hFromDisplay(draftValue)
        if (!isoValue) {
          setDraftValue(displayTimeFrom24h(value))
        }
      }}
    />
  )
}