import { BookOpenIcon } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { DialogClose } from '@/components/ui/dialog'

const ImageStudioApiGuide = lazy(() => import('./api-guide'))

export function ImageStudioApiDocsButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t('Image API docs')}
      description={t(
        'Call the image models from your own application with an API token.'
      )}
      contentClassName='sm:max-w-6xl'
      contentHeight='min(80dvh, 52rem)'
      showCloseButton={false}
      trigger={
        <Button type='button' variant='outline' size='sm' className='shrink-0'>
          <BookOpenIcon aria-hidden='true' />
          {t('Image API docs')}
        </Button>
      }
      footer={
        <DialogClose render={<Button type='button' variant='outline' />}>
          {t('Close')}
        </DialogClose>
      }
    >
      {open && (
        <Suspense fallback={<LoadingState />}>
          <ImageStudioApiGuide />
        </Suspense>
      )}
    </Dialog>
  )
}
