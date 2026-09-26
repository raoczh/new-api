import { Mail, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

export function ContactInformation() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const email = status?.contact_email?.trim()
  const wechatQR = status?.contact_wechat_qrcode?.trim()
  const qqGroup = status?.contact_qq_group?.trim()

  if (!email && !wechatQR && !qqGroup) return null

  return (
    <section className='border-t py-12' aria-labelledby='home-contact-title'>
      <div className='mx-auto max-w-6xl px-6'>
        <h2 id='home-contact-title' className='text-xl font-semibold'>
          {t('Contact Information')}
        </h2>
        <div className='mt-6 flex flex-wrap items-start gap-x-12 gap-y-6'>
          {email && (
            <div className='min-w-0'>
              <p className='text-muted-foreground mb-2 flex items-center gap-2 text-sm'>
                <Mail className='size-4' aria-hidden='true' />
                {t('Contact Email')}
              </p>
              <a
                className='text-sm font-medium break-all hover:underline'
                href={`mailto:${email}`}
              >
                {email}
              </a>
            </div>
          )}
          {wechatQR && (
            <div>
              <p className='text-muted-foreground mb-2 flex items-center gap-2 text-sm'>
                <MessageCircle className='size-4' aria-hidden='true' />
                {t('WeChat Group QR Code')}
              </p>
              <img
                src={wechatQR}
                alt={t('WeChat Group QR Code')}
                className='size-32 rounded-sm border bg-white object-contain p-1'
                loading='lazy'
              />
            </div>
          )}
          {qqGroup && (
            <div>
              <p className='text-muted-foreground mb-2 flex items-center gap-2 text-sm'>
                <MessageCircle className='size-4' aria-hidden='true' />
                {t('QQ Group')}
              </p>
              <p className='text-sm font-medium break-all'>{qqGroup}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
