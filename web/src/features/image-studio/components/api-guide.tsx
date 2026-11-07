import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePrimaryApiAddress } from '@/features/keys/hooks/use-api-addresses'
import { cn } from '@/lib/utils'

import {
  buildImageApiEndpoints,
  buildImageApiSample,
  GPT_IMAGE_CAPABILITY_ROWS,
  type ImageApiEndpoint,
  type ImageApiEndpointId,
  type ImageApiField,
  type ImageApiSampleLanguage,
} from '../lib/api-guide'

const SAMPLE_LANGUAGES: Array<{
  value: ImageApiSampleLanguage
  label: string
  highlight: 'bash' | 'javascript' | 'python'
}> = [
  { value: 'curl', label: 'cURL', highlight: 'bash' },
  { value: 'javascript', label: 'JavaScript', highlight: 'javascript' },
  { value: 'python', label: 'Python', highlight: 'python' },
]

/** API reference for the image endpoints, laid out like the public docs. */
export default function ImageStudioApiGuide() {
  const { t } = useTranslation()
  const endpoints = useMemo(() => buildImageApiEndpoints(t), [t])
  const [selectedId, setSelectedId] =
    useState<ImageApiEndpointId>('generations')
  const [language, setLanguage] = useState<ImageApiSampleLanguage>('curl')
  const primaryAddress = usePrimaryApiAddress().address
  const baseUrl = primaryAddress || window.location.origin
  const endpoint =
    endpoints.find((item) => item.id === selectedId) ?? endpoints[0]
  const groups = [...new Set(endpoints.map((item) => item.group))]

  return (
    <div className='grid min-w-0 gap-6 md:grid-cols-[11rem_minmax(0,1fr)]'>
      <nav
        aria-label={t('Image API endpoints')}
        className='flex flex-col gap-4'
      >
        {groups.map((group) => (
          <div key={group} className='flex flex-col gap-1'>
            <p className='text-muted-foreground px-2 text-xs font-medium'>
              {group}
            </p>
            {endpoints
              .filter((item) => item.group === group)
              .map((item) => (
                <button
                  key={item.id}
                  type='button'
                  aria-current={item.id === endpoint.id ? 'page' : undefined}
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'hover:bg-muted flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                    item.id === endpoint.id &&
                      'bg-primary/10 text-primary font-medium'
                  )}
                >
                  <span className='min-w-0 truncate'>{item.title}</span>
                  <span className='text-primary shrink-0 text-[10px] font-medium'>
                    POST
                  </span>
                </button>
              ))}
          </div>
        ))}
      </nav>
      <EndpointReference
        key={endpoint.id}
        endpoint={endpoint}
        baseUrl={baseUrl}
        language={language}
        onLanguageChange={setLanguage}
      />
    </div>
  )
}

interface EndpointReferenceProps {
  endpoint: ImageApiEndpoint
  baseUrl: string
  language: ImageApiSampleLanguage
  onLanguageChange: (language: ImageApiSampleLanguage) => void
}

function EndpointReference(props: EndpointReferenceProps) {
  const { t } = useTranslation()
  const [exampleId, setExampleId] = useState(props.endpoint.examples[0].id)
  const example =
    props.endpoint.examples.find((item) => item.id === exampleId) ??
    props.endpoint.examples[0]
  const highlight =
    SAMPLE_LANGUAGES.find((item) => item.value === props.language)?.highlight ??
    'bash'
  const sample = buildImageApiSample(
    props.endpoint,
    example,
    props.language,
    props.baseUrl
  )
  const showsCapabilities =
    props.endpoint.id === 'edits' || props.endpoint.id === 'generations'

  return (
    <article className='grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]'>
      <div className='flex min-w-0 flex-col gap-6'>
        <header className='flex flex-col gap-3'>
          <h2 className='text-lg font-semibold'>{props.endpoint.title}</h2>
          <p className='text-muted-foreground text-sm'>
            {props.endpoint.summary}
          </p>
          <div className='bg-muted/40 rounded-lg border px-3 py-2'>
            <p className='text-muted-foreground truncate text-xs'>
              {props.baseUrl}
            </p>
            <p className='mt-1 flex min-w-0 items-center gap-2 font-mono text-sm'>
              <Badge variant='outline' className='text-primary shrink-0'>
                POST
              </Badge>
              <span className='min-w-0 break-all'>{props.endpoint.path}</span>
            </p>
          </div>
        </header>

        <ReferenceSection title={t('Authorization')} aside='BearerAuth'>
          <p className='font-mono text-sm'>
            <span className='text-primary'>Authorization</span>{' '}
            <span className='text-muted-foreground'>Bearer &lt;token&gt;</span>
          </p>
          <p className='text-sm'>
            {t('Use Bearer token authentication. Format:')}{' '}
            <code className='bg-muted rounded px-1 py-0.5 font-mono text-xs'>
              Authorization: Bearer sk-xxxxxx
            </code>
          </p>
          <p className='text-muted-foreground text-xs'>
            In:{' '}
            <code className='bg-muted rounded px-1 py-0.5 font-mono'>
              header
            </code>
          </p>
        </ReferenceSection>

        {props.endpoint.pathParams && (
          <ReferenceSection title={t('Path Parameters')}>
            <FieldList fields={props.endpoint.pathParams} />
          </ReferenceSection>
        )}

        <ReferenceSection
          title={t('Request Body')}
          aside={props.endpoint.contentType}
        >
          <FieldList fields={props.endpoint.requestFields} />
        </ReferenceSection>

        {showsCapabilities && (
          <ReferenceSection title={t('gpt-image-2 series capabilities')}>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Available only where the model and channel enable them. SVG and GIF results are returned as image URLs; GIF cannot be streamed.'
              )}
            </p>
            <div className='overflow-x-auto rounded-lg border'>
              <table className='w-full text-left text-xs'>
                <thead className='bg-muted/40'>
                  <tr>
                    <th className='px-3 py-2 font-medium'>{t('Model')}</th>
                    <th className='px-3 py-2 font-medium'>quality</th>
                    <th className='px-3 py-2 font-medium'>output_format</th>
                  </tr>
                </thead>
                <tbody>
                  {GPT_IMAGE_CAPABILITY_ROWS.map((row) => (
                    <tr key={row.models} className='border-t'>
                      <td className='px-3 py-2 font-mono'>{row.models}</td>
                      <td className='px-3 py-2 font-mono'>{row.qualities}</td>
                      <td className='px-3 py-2 font-mono'>{row.formats}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReferenceSection>
        )}

        <ReferenceSection title={t('Response Body')} aside='application/json'>
          <p className='text-sm'>
            <span className='font-mono'>200</span>{' '}
            <span className='text-muted-foreground'>{t('Success')}</span>
          </p>
          <FieldList fields={props.endpoint.responseFields} />
        </ReferenceSection>
      </div>

      <aside className='flex min-w-0 flex-col gap-4 lg:sticky lg:top-0 lg:self-start'>
        <div className='flex flex-wrap items-center gap-2'>
          {props.endpoint.examples.length > 1 && (
            <Tabs value={example.id} onValueChange={setExampleId}>
              <TabsList
                aria-label={t('Request example')}
                className='bg-muted/40 h-8 p-0.5'
              >
                {props.endpoint.examples.map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className='h-7 px-2.5 text-xs'
                  >
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          <Tabs
            value={props.language}
            onValueChange={(value) =>
              props.onLanguageChange(value as ImageApiSampleLanguage)
            }
            className='ml-auto'
          >
            <TabsList
              aria-label={t('Code language')}
              className='bg-muted/40 h-8 p-0.5'
            >
              {SAMPLE_LANGUAGES.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className='h-7 px-2.5 text-xs'
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <CodeBlock code={sample} language={highlight} enableCollapse={false}>
          <CodeBlockCopyButton />
        </CodeBlock>
        <CodeBlock
          code={JSON.stringify(props.endpoint.response, null, 2)}
          language='json'
          title='200'
          enableCollapse={false}
        >
          <CodeBlockCopyButton />
        </CodeBlock>
      </aside>
    </article>
  )
}

interface ReferenceSectionProps {
  title: string
  aside?: string
  children: ReactNode
}

function ReferenceSection(props: ReferenceSectionProps) {
  return (
    <section className='flex flex-col gap-3'>
      <div className='flex items-baseline justify-between gap-3'>
        <h3 className='text-base font-semibold'>{props.title}</h3>
        {props.aside && (
          <span className='text-muted-foreground text-xs'>{props.aside}</span>
        )}
      </div>
      {props.children}
    </section>
  )
}

function FieldList(props: { fields: ImageApiField[] }) {
  return (
    <dl className='divide-y rounded-lg border'>
      {props.fields.map((field) => (
        <div key={field.name} className='flex flex-col gap-1 px-3 py-2.5'>
          <dt className='font-mono text-sm'>
            <span className='text-primary'>{field.name}</span>
            <span className='text-muted-foreground'>
              {field.required ? '*' : '?'}
            </span>{' '}
            <span className='text-muted-foreground text-xs'>{field.type}</span>
          </dt>
          <dd className='text-sm leading-relaxed'>{field.description}</dd>
        </div>
      ))}
    </dl>
  )
}
