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
import { ChevronDown } from 'lucide-react'
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
import { getUserGroups, getUserModels } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { getLobeIcon } from '@/lib/lobe-icon'
import {
  requireServerSuccess,
  translateServerText,
} from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import {
  createApiKey,
  getApiKey,
  getTokenAutoGroups,
  updateApiKey,
} from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import {
  API_KEY_FORM_DEFAULT_VALUES,
  getApiKeyFormSchema,
  groupKeyVendors,
  keyToRoute,
  resolveVendorAutoRoute,
  routeToKeyGroups,
  suggestKeyName,
  transformApiKeyToFormDefaults,
  transformFormDataToPayload,
  UNASSIGNED_VENDOR_ID,
  type ApiKeyFormValues,
  type KeyVendorChoice,
} from '../lib'
import type { ApiKey } from '../types'
import {
  ApiKeyAccessFields,
  ApiKeyCountField,
  ApiKeyExpiryField,
  ApiKeyQuotaFields,
} from './api-key-form-fields'
import type { ApiKeyGroupOption } from './api-key-group-combobox'
import { useApiKeys } from './api-keys-provider'
import { AutoGroupOrderEditor } from './auto-group-order-editor'

type ApiKeyFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The key to edit. Without one the dialog creates a key. */
  apiKey?: ApiKey
}

/**
 * Creating or editing a key starts from the model vendor instead of a raw
 * group list: pick a vendor, and the lines the administrator arranged for it
 * are ticked in that order. The lines can be ticked, cleared and reordered in
 * place. An edited key opens on the lines it already uses.
 */
export function ApiKeyFormDialog(props: ApiKeyFormDialogProps) {
  const { t } = useTranslation()
  const { triggerRefresh, setCreatedKeyId, setOpen } = useApiKeys()
  const editedKeyId = props.apiKey?.id
  const isUpdate = editedKeyId !== undefined
  const [vendorId, setVendorId] = useState<number | null>(null)
  // Null until the user changes the lines: a new key uses the vendor's
  // default so far, an edited key the lines it was saved with.
  const [editedRoute, setEditedRoute] = useState<string[] | null>(null)
  const [nameEdited, setNameEdited] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // The key whose stored values the form currently holds.
  const [loadedKeyId, setLoadedKeyId] = useState<number | null>(null)

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
  // The list row can hold a stale quota, so editing starts from the stored key.
  const keyQuery = useQuery({
    queryKey: ['api-key', editedKeyId],
    queryFn: async () =>
      requireServerSuccess(await getApiKey(editedKeyId ?? 0)),
    enabled: props.open && isUpdate,
    staleTime: 0,
  })
  const storedKey = isUpdate ? keyQuery.data?.data : undefined

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

  const availableLines = useMemo(
    () =>
      groupOptions
        .filter((option) => option.value !== 'auto')
        .map((option) => option.value),
    [groupOptions]
  )
  const storedRoute = useMemo(
    () =>
      storedKey
        ? keyToRoute(storedKey, globalAutoGroups ?? [], availableLines).slice(
            0,
            maxLines
          )
        : [],
    [storedKey, globalAutoGroups, availableLines, maxLines]
  )
  // An edited key opens on the vendor of its first line.
  const vendor =
    vendors.find((choice) => choice.id === vendorId) ??
    vendors.find((choice) => choice.groups.includes(storedRoute[0] ?? '')) ??
    vendors[0]
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
  const route = editedRoute ?? (isUpdate ? storedRoute : autoRoute)
  // Lines of another vendor that the key already uses stay listed, so they
  // keep their ratio and can be cleared.
  const vendorOptions = useMemo(
    () =>
      groupOptions.filter(
        (option) =>
          vendor?.groups.includes(option.value) || route.includes(option.value)
      ),
    [groupOptions, vendor, route]
  )
  const firstLine = route[0] ?? ''
  const vendorName = vendor ? getVendorLabel(vendor, t('Other models')) : ''
  const suggestedName = suggestKeyName(vendorName, firstLine)

  // A closed dialog always reopens on a clean form.
  useEffect(() => {
    if (props.open) return
    form.reset(API_KEY_FORM_DEFAULT_VALUES)
    setVendorId(null)
    setEditedRoute(null)
    setNameEdited(false)
    setOptionsOpen(false)
    setLoadedKeyId(null)
  }, [props.open, form])

  const listsReady =
    groupsQuery.isFetched &&
    !groupsQuery.isFetching &&
    autoGroupsQuery.isFetched &&
    !autoGroupsQuery.isFetching
  // An edited key fills the form once, when it and the lines have loaded.
  useEffect(() => {
    if (!props.open || !storedKey || !listsReady) return
    if (keyQuery.isFetching || loadedKeyId === storedKey.id) return
    form.reset(
      transformApiKeyToFormDefaults(storedKey, availableLines, maxLines)
    )
    setLoadedKeyId(storedKey.id)
    // The limits are what an existing key is usually opened for.
    setOptionsOpen(true)
  }, [
    props.open,
    storedKey,
    listsReady,
    keyQuery.isFetching,
    loadedKeyId,
    form,
    availableLines,
    maxLines,
  ])

  // The name of a new key follows the vendor and first line until the user
  // types their own.
  useEffect(() => {
    if (!props.open || isUpdate || nameEdited) return
    form.setValue('name', suggestedName)
  }, [props.open, isUpdate, nameEdited, suggestedName, form])

  const isReady = isUpdate
    ? listsReady && loadedKeyId === editedKeyId
    : groupsQuery.isFetched && autoGroupsQuery.isFetched
  const hasFailed =
    groupsQuery.isError || autoGroupsQuery.isError || keyQuery.isError
  // A key that follows the account's group has no line of its own, and stays
  // that way until lines are ticked for it.
  const followsUserGroup = isUpdate && editedRoute === null && !storedKey?.group
  const canSubmit = route.length > 0 || followsUserGroup

  // The form keeps the stored group fields of an edited key, and they are
  // validated on submit, so chosen lines are written into them right away.
  const chooseLines = (lines: string[]) => {
    setEditedRoute(lines)
    const stored = routeToKeyGroups(lines)
    form.setValue('group', stored.group, { shouldDirty: true })
    form.setValue('auto_groups_mode', stored.auto_groups_mode)
    form.setValue('auto_groups', stored.auto_groups, { shouldDirty: true })
    form.setValue('cross_group_retry', stored.cross_group_retry)
    form.clearErrors('auto_groups')
  }

  const selectVendor = (id: number) => {
    setVendorId(id)
    if (!isUpdate) {
      setEditedRoute(null)
      return
    }
    const next = vendors.find((choice) => choice.id === id)
    chooseLines(
      next
        ? resolveVendorAutoRoute(next.groups, globalAutoGroups ?? [], maxLines)
        : []
    )
  }

  const saveChanges = async (data: ApiKeyFormValues, id: number) => {
    // Untouched lines are saved as they were stored, which keeps a key on
    // the site-wide line order or on the account's group.
    const result = await updateApiKey({
      ...transformFormDataToPayload(
        editedRoute === null ? data : { ...data, ...routeToKeyGroups(route) }
      ),
      id,
    })
    if (!result.success) {
      handleServerError(result, t(ERROR_MESSAGES.UPDATE_FAILED))
      return
    }
    toast.success(t(SUCCESS_MESSAGES.API_KEY_UPDATED))
    triggerRefresh()
    props.onOpenChange(false)
  }

  const onSubmit = async (data: ApiKeyFormValues) => {
    if (!canSubmit) {
      toast.error(t('Choose at least one line for this key'))
      return
    }
    setIsSubmitting(true)
    try {
      if (editedKeyId !== undefined) {
        await saveChanges(data, editedKeyId)
        return
      }
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

  const onInvalid: SubmitErrorHandler<ApiKeyFormValues> = (errors) => {
    // The stored lines of an edited key can all have become unavailable.
    toast.error(
      errors.auto_groups
        ? t('Choose at least one line for this key')
        : t('Please fix the highlighted fields before saving')
    )
  }

  let submitLabel = isSubmitting ? t('Creating...') : t('Create API Key')
  if (isUpdate) {
    submitLabel = isSubmitting ? t('Saving...') : t('Save changes')
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
          id='api-key-form'
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
            <legend className='text-sm font-medium'>{t('Line')}</legend>
            <p className='text-muted-foreground text-xs'>
              {t(
                'Lines are tried from top to bottom: if the first one is busy or fails, the next one takes over. Tick lines in the list, and drag to reorder.'
              )}
            </p>
            <AutoGroupOrderEditor
              aria-label={t('Line')}
              value={route}
              mode='custom'
              options={vendorOptions}
              globalOptions={[]}
              maxCount={maxLines}
              hideModeHeader
              numbered
              tickInPicker
              addPlaceholder={t('Choose lines')}
              emptyText={
                followsUserGroup
                  ? t(
                      'This key follows the group of your account. Tick lines above to give it lines of its own.'
                    )
                  : t('No line is chosen. Tick at least one line above.')
              }
              onChange={(value) => chooseLines(value.groups)}
            />
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
                {!isUpdate && <ApiKeyCountField />}
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
      title={isUpdate ? t('Update API Key') : t('Create API Key')}
      description={
        isUpdate
          ? t(
              'Change the lines, name or limits of this key. The key itself stays the same.'
            )
          : t(
              'Choose which models this key is for. Everything else has a sensible default.'
            )
      }
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
            form='api-key-form'
            disabled={!isReady || !vendor || !canSubmit || isSubmitting}
          >
            {submitLabel}
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
