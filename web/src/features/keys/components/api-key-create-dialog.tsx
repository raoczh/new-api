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
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Route, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type SubmitErrorHandler } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getUserGroups, getUserModels } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { getLobeIcon } from '@/lib/lobe-icon'
import {
  requireServerSuccess,
  translateServerText,
} from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { createApiKey, getTokenAutoGroups } from '../api'
import { ERROR_MESSAGES } from '../constants'
import {
  API_KEY_FORM_DEFAULT_VALUES,
  getApiKeyFormSchema,
  groupKeyVendors,
  resolveVendorAutoRoute,
  routeToKeyGroups,
  suggestKeyName,
  transformFormDataToPayload,
  UNASSIGNED_VENDOR_ID,
  type ApiKeyFormValues,
  type KeyVendorChoice,
} from '../lib'
import {
  ApiKeyAccessFields,
  ApiKeyCountField,
  ApiKeyExpiryField,
  ApiKeyQuotaFields,
} from './api-key-form-fields'
import type { ApiKeyGroupOption } from './api-key-group-combobox'
import { useApiKeys } from './api-keys-provider'
import { AutoGroupOrderEditor } from './auto-group-order-editor'
import { GroupRatioBadge } from './auto-group-visuals'

type RouteMode = 'auto' | 'custom'

type ApiKeyCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Creating a key starts from the model vendor instead of a raw group list:
 * pick a vendor, and the lines the administrator arranged for it are used in
 * order. Reordering or replacing a line switches the key to a custom route.
 */
export function ApiKeyCreateDialog(props: ApiKeyCreateDialogProps) {
  const { t } = useTranslation()
  const { triggerRefresh, setCreatedKeyId, setOpen } = useApiKeys()
  const [vendorId, setVendorId] = useState<number | null>(null)
  const [routeMode, setRouteMode] = useState<RouteMode>('auto')
  const [customRoute, setCustomRoute] = useState<string[]>([])
  const [nameEdited, setNameEdited] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const groupsQuery = useQuery({
    queryKey: ['user-groups'],
    queryFn: async () => requireServerSuccess(await getUserGroups()),
    enabled: props.open,
    staleTime: 0,
  })
  const autoGroupsQuery = useQuery({
    queryKey: ['token-auto-groups'],
    queryFn: async () => requireServerSuccess(await getTokenAutoGroups()),
    enabled: props.open,
    staleTime: 0,
  })
  const modelsQuery = useQuery({
    queryKey: ['user-models'],
    queryFn: async () => requireServerSuccess(await getUserModels()),
    enabled: props.open,
    staleTime: 0,
  })

  const groupOptions = useMemo<ApiKeyGroupOption[]>(
    () =>
      Object.entries(groupsQuery.data?.data ?? {}).map(([name, info]) => ({
        value: name,
        label: name,
        desc: info.desc ? translateServerText(t, info.desc) : name,
        ratio: info.ratio,
      })),
    [groupsQuery.data, t]
  )
  const vendors = useMemo(
    () =>
      groupKeyVendors(
        groupsQuery.data?.data ?? {},
        groupsQuery.data?.vendors ?? [],
        groupsQuery.data?.group_order ?? []
      ),
    [groupsQuery.data]
  )
  const reportedMax = Number(autoGroupsQuery.data?.data?.max_count)
  const maxLines =
    Number.isInteger(reportedMax) && reportedMax > 0 ? reportedMax : 5
  const globalAutoGroups = autoGroupsQuery.data?.data?.groups
  const schema = useMemo(() => getApiKeyFormSchema(t, maxLines), [t, maxLines])
  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: API_KEY_FORM_DEFAULT_VALUES,
  })

  const vendor = vendors.find((choice) => choice.id === vendorId) ?? vendors[0]
  const vendorOptions = useMemo(
    () =>
      groupOptions.filter((option) => vendor?.groups.includes(option.value)),
    [groupOptions, vendor]
  )
  const autoRoute = useMemo(
    () =>
      vendor
        ? resolveVendorAutoRoute(
            vendor.groups,
            globalAutoGroups ?? [],
            maxLines
          )
        : [],
    [vendor, globalAutoGroups, maxLines]
  )
  const route = routeMode === 'auto' ? autoRoute : customRoute
  const firstLine = route[0] ?? ''
  const vendorName = vendor ? getVendorLabel(vendor, t('Other models')) : ''
  const suggestedName = suggestKeyName(vendorName, firstLine)

  // A closed dialog always reopens on a clean form.
  useEffect(() => {
    if (props.open) return
    form.reset(API_KEY_FORM_DEFAULT_VALUES)
    setVendorId(null)
    setRouteMode('auto')
    setCustomRoute([])
    setNameEdited(false)
    setOptionsOpen(false)
  }, [props.open, form])

  // The name follows the vendor and first line until the user types their own.
  useEffect(() => {
    if (!props.open || nameEdited) return
    form.setValue('name', suggestedName)
  }, [props.open, nameEdited, suggestedName, form])

  const isReady = groupsQuery.isFetched && autoGroupsQuery.isFetched
  const hasFailed = groupsQuery.isError || autoGroupsQuery.isError

  const selectVendor = (id: number) => {
    setVendorId(id)
    setRouteMode('auto')
    setCustomRoute([])
  }

  const onSubmit = async (data: ApiKeyFormValues) => {
    if (route.length === 0) {
      toast.error(t('Choose at least one line for this key'))
      return
    }
    setIsSubmitting(true)
    try {
      const payload = transformFormDataToPayload({
        ...data,
        ...routeToKeyGroups(route),
      })
      const count = data.tokenCount || 1
      const createdIds: number[] = []
      for (let i = 0; i < count; i++) {
        const result = await createApiKey({
          ...payload,
          name:
            i === 0
              ? data.name
              : `${data.name}-${Math.random().toString(36).slice(2, 8)}`,
        })
        if (!result.success) {
          handleServerError(result, t(ERROR_MESSAGES.CREATE_FAILED))
          break
        }
        if (result.data?.id) createdIds.push(result.data.id)
      }
      if (createdIds.length === 0) return

      triggerRefresh()
      if (count > 1) {
        toast.success(
          t('Successfully created {{count}} API Key(s)', {
            count: createdIds.length,
          })
        )
        props.onOpenChange(false)
        return
      }
      setCreatedKeyId(createdIds[0])
      setOpen('created')
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsSubmitting(false)
    }
  }

  const onInvalid: SubmitErrorHandler<ApiKeyFormValues> = () => {
    toast.error(t('Please fix the highlighted fields before saving'))
  }

  let body = <LoadingState message={t('Loading...')} />
  if (hasFailed) {
    body = (
      <p role='alert' className='text-destructive py-6 text-sm'>
        {t(
          'Failed to load the available lines. Close this window and try again.'
        )}
      </p>
    )
  } else if (isReady && vendors.length === 0) {
    body = (
      <p role='status' className='text-muted-foreground py-6 text-sm'>
        {t(
          'No lines are available for your account yet. Please contact support.'
        )}
      </p>
    )
  } else if (isReady && vendor) {
    body = (
      <Form {...form}>
        <form
          id='api-key-create-form'
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          inert={isSubmitting ? true : undefined}
          className='flex flex-col gap-5'
        >
          <VendorPicker
            vendors={vendors}
            value={vendor.id}
            onChange={selectVendor}
          />

          <fieldset className='flex flex-col gap-2'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <legend className='text-sm font-medium'>{t('Line')}</legend>
              <ToggleGroup
                value={[routeMode]}
                onValueChange={(values) => {
                  const next = values.find((value) => value !== routeMode)
                  if (next !== 'auto' && next !== 'custom') return
                  if (next === 'custom') setCustomRoute(autoRoute)
                  setRouteMode(next)
                }}
                variant='outline'
                size='sm'
                aria-label={t('Line')}
              >
                <ToggleGroupItem value='auto'>
                  <Sparkles aria-hidden='true' />
                  {t('Automatic')}
                </ToggleGroupItem>
                <ToggleGroupItem value='custom'>
                  <Route aria-hidden='true' />
                  {t('Custom')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <p className='text-muted-foreground text-xs'>
              {routeMode === 'auto'
                ? t(
                    'We pick the lines for you. If the first one is busy or fails, the next one takes over.'
                  )
                : t(
                    'Lines are tried from top to bottom. Drag to reorder, or add and remove lines.'
                  )}
            </p>
            {routeMode === 'auto' ? (
              <RoutePreview
                route={autoRoute}
                options={groupOptions}
                onCustomize={() => {
                  setCustomRoute(autoRoute)
                  setRouteMode('custom')
                }}
              />
            ) : (
              <AutoGroupOrderEditor
                aria-label={t('Line')}
                value={customRoute}
                mode='custom'
                options={vendorOptions}
                globalOptions={[]}
                maxCount={maxLines}
                hideModeHeader
                numbered
                addPlaceholder={t('Add a line')}
                onChange={(value) => setCustomRoute(value.groups)}
              />
            )}
          </fieldset>

          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Name')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('Enter a name')}
                    onChange={(event) => {
                      setNameEdited(true)
                      field.onChange(event)
                    }}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Only you see this name. It helps you tell your keys apart.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
            <CollapsibleTrigger
              render={
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='text-muted-foreground -ml-2.5'
                />
              }
            >
              <ChevronDown
                aria-hidden='true'
                className={cn(
                  'transition-transform',
                  optionsOpen && 'rotate-180'
                )}
              />
              {t('More options')}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className='flex flex-col gap-4 pt-3'>
                <ApiKeyQuotaFields />
                <ApiKeyExpiryField />
                <ApiKeyCountField />
                <ApiKeyAccessFields models={modelsQuery.data?.data ?? []} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </form>
      </Form>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open && isSubmitting) return
        props.onOpenChange(open)
      }}
      title={t('Create API Key')}
      description={t(
        'Choose which models this key is for. Everything else has a sensible default.'
      )}
      contentClassName='sm:max-w-xl'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            disabled={isSubmitting}
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form='api-key-create-form'
            disabled={!isReady || !vendor || route.length === 0 || isSubmitting}
          >
            {isSubmitting ? t('Creating...') : t('Create API Key')}
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  )
}

function getVendorLabel(vendor: KeyVendorChoice, fallback: string): string {
  return vendor.id === UNASSIGNED_VENDOR_ID ? fallback : vendor.name
}

function VendorPicker(props: {
  vendors: KeyVendorChoice[]
  value: number
  onChange: (id: number) => void
}) {
  const { t } = useTranslation()
  const selected = props.vendors.find((vendor) => vendor.id === props.value)
  const description =
    selected && selected.id !== UNASSIGNED_VENDOR_ID
      ? selected.description
      : t('Lines that are not tied to one model vendor.')

  return (
    <fieldset className='flex flex-col gap-2'>
      <legend className='mb-2 text-sm font-medium'>{t('Model vendor')}</legend>
      <RadioGroup
        value={String(props.value)}
        onValueChange={(value) => props.onChange(Number(value))}
        aria-label={t('Model vendor')}
        className='grid grid-cols-2 gap-2 sm:grid-cols-3'
      >
        {props.vendors.map((vendor) => {
          const id = `api-key-vendor-${vendor.id}`
          const label = getVendorLabel(vendor, t('Other models'))
          return (
            <Label
              key={vendor.id}
              htmlFor={id}
              className='hover:border-primary/40 has-data-[checked]:border-primary has-data-[checked]:bg-primary/5 has-data-[checked]:ring-primary/20 bg-card flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 font-normal transition-colors has-data-[checked]:ring-2'
            >
              <RadioGroupItem
                id={id}
                value={String(vendor.id)}
                className='sr-only'
              />
              <span
                aria-hidden='true'
                className='bg-muted/50 flex size-8 shrink-0 items-center justify-center rounded-lg'
              >
                {vendor.icon ? (
                  getLobeIcon(vendor.icon, 20)
                ) : (
                  <span className='text-muted-foreground text-xs font-semibold'>
                    {label.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <span className='flex min-w-0 flex-col gap-0.5'>
                <span className='truncate text-sm font-medium' title={label}>
                  {label}
                </span>
                <span className='text-muted-foreground text-xs'>
                  {t('{{count}} lines', { count: vendor.groups.length })}
                </span>
              </span>
            </Label>
          )
        })}
      </RadioGroup>
      {description && (
        <p
          aria-live='polite'
          className='text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-line'
        >
          {description}
        </p>
      )}
    </fieldset>
  )
}

function RoutePreview(props: {
  route: string[]
  options: ApiKeyGroupOption[]
  onCustomize: () => void
}) {
  const { t } = useTranslation()
  const optionByName = new Map(
    props.options.map((option) => [option.value, option])
  )

  return (
    <div className='flex flex-col gap-2'>
      <ol aria-label={t('Line')} className='flex flex-col gap-1.5'>
        {props.route.map((name, index) => {
          const option = optionByName.get(name)
          return (
            <li
              key={name}
              className='bg-muted/30 flex min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2'
            >
              <span
                aria-hidden='true'
                className='bg-primary/10 text-primary flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums'
              >
                {index + 1}
              </span>
              <span className='flex min-w-0 flex-1 flex-col'>
                <span className='truncate text-sm font-medium' title={name}>
                  {name}
                </span>
                {option?.desc && option.desc !== name && (
                  <span
                    className='text-muted-foreground truncate text-xs'
                    title={option.desc}
                  >
                    {option.desc}
                  </span>
                )}
              </span>
              <span className='text-muted-foreground shrink-0 text-xs'>
                {index === 0 ? t('Used first') : t('Backup')}
              </span>
              <GroupRatioBadge ratio={option?.ratio} />
            </li>
          )
        })}
      </ol>
      <Button
        type='button'
        variant='link'
        size='sm'
        className='h-auto self-start p-0 text-xs'
        onClick={props.onCustomize}
      >
        {t('Change the lines or their order')}
      </Button>
    </div>
  )
}
