import { useEffect, useMemo, useState } from 'react'
import {
  formatDateDisplay,
  displayDateFromIso,
  isoDateFromDisplay,
} from '../../utils/smartDateInput'

export default function SmartDateInput({ value, onChange, className = 'form-input', id, name, placeholder = 'DD/MM/AAAA' }) {
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [draftValue, setDraftValue] = useState('')
  const displayValue = useMemo(() => displayDateFromIso(value), [value])

  useEffect(() => {
    setDraftValue(displayValue)
  }, [displayValue])

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)')
    const update = () => setIsTouchDevice(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  if (isTouchDevice) {
    return (
      <input
        id={id}
        name={name}
        type="date"
        className={className}
        value={value}
        onChange={onChange}
      />
    )
  }

  return (
    <input
      id={id}
      name={name}
      type="text"
      className={className}
      inputMode="numeric"
      placeholder={placeholder}
      value={draftValue}
      onChange={e => {
        const formatted = formatDateDisplay(e.target.value)
        setDraftValue(formatted)
        const isoValue = isoDateFromDisplay(formatted)
        if (isoValue || formatted === '') {
          onChange({ target: { name, value: isoValue } })
        }
      }}
      onBlur={() => {
        const isoValue = isoDateFromDisplay(draftValue)
        if (!isoValue) {
          setDraftValue(displayValue)
        }
      }}
    />
  )
}
