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
import { Radio } from '@base-ui/react/radio'
import { Monitor, Sun, MoonStar } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { RadioGroup } from '@/components/ui/radio-group'
import { useTheme } from '@/context/theme-provider'

export function ThemeQuickSwitcher() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const options = [
    { value: 'system', label: t('System'), icon: Monitor },
    { value: 'light', label: t('Light'), icon: Sun },
    { value: 'dark', label: t('Dark'), icon: MoonStar },
  ] as const

  return (
    <div className='flex items-center justify-between gap-3 px-2 py-2'>
      <span className='text-muted-foreground text-sm'>{t('Theme')}</span>
      <RadioGroup
        value={theme}
        onValueChange={setTheme}
        aria-label={t('Theme')}
        className='bg-muted/40 flex w-auto gap-1 rounded-lg border p-1'
      >
        {options.map((option) => (
          <Radio.Root
            key={option.value}
            value={option.value}
            aria-label={option.label}
            className='text-muted-foreground hover:text-foreground focus-visible:ring-ring data-checked:bg-card data-checked:text-foreground flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2 data-checked:shadow-xs'
          >
            <option.icon className='size-4' aria-hidden='true' />
          </Radio.Root>
        ))}
      </RadioGroup>
    </div>
  )
}
