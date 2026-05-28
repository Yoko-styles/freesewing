import React from 'react'
import { logoPath } from '@freesewing/config'

/*
 * The FreeSewing logo, aka Skully, as a React component
 *
 * @params {object} props - All React props
 * @params {string} className - Custom CSS classes to apply
 * @params {string} theme - The theme, light or dark. Although by default this component will auto-adapt by using currentColor
 * @params {number} stroke - Set this to also stroke the logo
 */
export const FreeSewingLogo = ({ className = 'w-20 h-20', theme = 'light', stroke = false }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 44" className={className}>
      <path d={logoPath} fill="#D07D7A" />
    </svg>
  )
}
