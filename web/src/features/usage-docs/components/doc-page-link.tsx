/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

type DocPageLinkProps = {
  /** Page slug; an empty slug links to the introduction at /docs. */
  slug: string
  className?: string
  'aria-current'?: 'page'
  onClick?: () => void
  children: ReactNode
}

/** Link to a documentation page through the typed /docs routes. */
export function DocPageLink(props: DocPageLinkProps) {
  if (!props.slug) {
    return (
      <Link
        to='/docs'
        className={props.className}
        aria-current={props['aria-current']}
        onClick={props.onClick}
      >
        {props.children}
      </Link>
    )
  }

  return (
    <Link
      to='/docs/$'
      params={{ _splat: props.slug }}
      className={props.className}
      aria-current={props['aria-current']}
      onClick={props.onClick}
    >
      {props.children}
    </Link>
  )
}
