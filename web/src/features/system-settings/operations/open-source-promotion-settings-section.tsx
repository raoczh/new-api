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
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import {
  SettingsForm,
  SettingsFormGrid,
  SettingsFormGridItem,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { OpenSourcePromotionEmailPreview } from './open-source-promotion-email-preview'

const schema = z.object({
  enabled: z.boolean(),
  githubToken: z.string(),
  githubRequestsPerMinute: z.coerce.number().int().min(0).max(600),
  keywords: z.string(),
  topicChinese: z.boolean(),
  minStars: z.coerce.number().int().min(0),
  maxStars: z.coerce.number().int().min(0),
  activeDays: z.coerce.number().int().min(1).max(3650),
  maxReposPerRun: z.coerce.number().int().min(1).max(100),
  maxAuthorsPerRepo: z.coerce.number().int().min(1).max(20),
  includePrAuthors: z.boolean(),
  requireChineseProject: z.boolean(),
  requireChineseAuthor: z.boolean(),
  emailWhitelist: z.string(),
  autoSendEnabled: z.boolean(),
  fetchTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  sendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  dailySendLimit: z.coerce.number().int().min(1).max(1000),
  sendIntervalSeconds: z.coerce.number().int().min(5).max(3600),
  rewardAmount: z.coerce.number().min(0).max(1_000_000),
  rewardNote: z.string(),
  emailSubject: z.string(),
  emailBody: z.string(),
})

type Values = z.infer<typeof schema>

export type OpenSourcePromotionDefaults = {
  enabled: boolean
  githubToken: string
  githubTokenConfigured: boolean
  githubRequestsPerMinute: number
  keywords: string[]
  topicChinese: boolean
  minStars: number
  maxStars: number
  activeDays: number
  maxReposPerRun: number
  maxAuthorsPerRepo: number
  includePrAuthors: boolean
  requireChineseProject: boolean
  requireChineseAuthor: boolean
  emailWhitelist: string[]
  autoSendEnabled: boolean
  fetchTime: string
  sendTime: string
  dailySendLimit: number
  sendIntervalSeconds: number
  rewardAmount: number
  rewardNote: string
  emailSubject: string
  emailBody: string
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function joinLines(values: string[]): string {
  return values.join('\n')
}

export function OpenSourcePromotionSettingsSection({
  defaultValues,
}: {
  defaultValues: OpenSourcePromotionDefaults
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: defaultValues.enabled,
      githubToken: '',
      githubRequestsPerMinute: defaultValues.githubRequestsPerMinute,
      keywords: joinLines(defaultValues.keywords),
      topicChinese: defaultValues.topicChinese,
      minStars: defaultValues.minStars,
      maxStars: defaultValues.maxStars,
      activeDays: defaultValues.activeDays,
      maxReposPerRun: defaultValues.maxReposPerRun,
      maxAuthorsPerRepo: defaultValues.maxAuthorsPerRepo,
      includePrAuthors: defaultValues.includePrAuthors,
      requireChineseProject: defaultValues.requireChineseProject,
      requireChineseAuthor: defaultValues.requireChineseAuthor,
      emailWhitelist: joinLines(defaultValues.emailWhitelist),
      autoSendEnabled: defaultValues.autoSendEnabled,
      fetchTime: defaultValues.fetchTime,
      sendTime: defaultValues.sendTime,
      dailySendLimit: defaultValues.dailySendLimit,
      sendIntervalSeconds: defaultValues.sendIntervalSeconds,
      rewardAmount: defaultValues.rewardAmount,
      rewardNote: defaultValues.rewardNote,
      emailSubject: defaultValues.emailSubject,
      emailBody: defaultValues.emailBody,
    },
  })

  const { isDirty, isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []
    const push = (key: string, value: string | number | boolean) => {
      updates.push({ key: `open_source_promotion.${key}`, value: String(value) })
    }

    if (values.enabled !== defaultValues.enabled) push('enabled', values.enabled)
    if (values.githubToken.trim() !== '') {
      push('github_token', values.githubToken.trim())
    }
    if (values.githubRequestsPerMinute !== defaultValues.githubRequestsPerMinute) {
      push('github_requests_per_minute', values.githubRequestsPerMinute)
    }
    const keywords = splitLines(values.keywords)
    if (keywords.join('|') !== defaultValues.keywords.join('|')) {
      push('keywords', JSON.stringify(keywords))
    }
    if (values.topicChinese !== defaultValues.topicChinese) {
      push('topic_chinese', values.topicChinese)
    }
    if (values.minStars !== defaultValues.minStars) push('min_stars', values.minStars)
    if (values.maxStars !== defaultValues.maxStars) push('max_stars', values.maxStars)
    if (values.activeDays !== defaultValues.activeDays) {
      push('active_days', values.activeDays)
    }
    if (values.maxReposPerRun !== defaultValues.maxReposPerRun) {
      push('max_repos_per_run', values.maxReposPerRun)
    }
    if (values.maxAuthorsPerRepo !== defaultValues.maxAuthorsPerRepo) {
      push('max_authors_per_repo', values.maxAuthorsPerRepo)
    }
    if (values.includePrAuthors !== defaultValues.includePrAuthors) {
      push('include_pr_authors', values.includePrAuthors)
    }
    if (values.requireChineseProject !== defaultValues.requireChineseProject) {
      push('require_chinese_project', values.requireChineseProject)
    }
    if (values.requireChineseAuthor !== defaultValues.requireChineseAuthor) {
      push('require_chinese_author', values.requireChineseAuthor)
    }
    const whitelist = splitLines(values.emailWhitelist)
    if (whitelist.join('|') !== defaultValues.emailWhitelist.join('|')) {
      push('email_whitelist', JSON.stringify(whitelist))
    }
    if (values.autoSendEnabled !== defaultValues.autoSendEnabled) {
      push('auto_send_enabled', values.autoSendEnabled)
    }
    if (values.fetchTime !== defaultValues.fetchTime) {
      push('fetch_time', values.fetchTime)
    }
    if (values.sendTime !== defaultValues.sendTime) {
      push('send_time', values.sendTime)
    }
    if (values.dailySendLimit !== defaultValues.dailySendLimit) {
      push('daily_send_limit', values.dailySendLimit)
    }
    if (values.sendIntervalSeconds !== defaultValues.sendIntervalSeconds) {
      push('send_interval_seconds', values.sendIntervalSeconds)
    }
    if (values.rewardAmount !== defaultValues.rewardAmount) {
      push('reward_amount', values.rewardAmount)
    }
    if (values.rewardNote !== defaultValues.rewardNote) {
      push('reward_note', values.rewardNote)
    }
    if (values.emailSubject !== defaultValues.emailSubject) {
      push('email_subject', values.emailSubject)
    }
    if (values.emailBody !== defaultValues.emailBody) {
      push('email_body', values.emailBody)
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }

    form.reset({ ...values, githubToken: '' })
  }

  const enabled = form.watch('enabled')

  return (
    <SettingsSection title={t('Open source promotion')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save open-source promotion settings'
          />

          <p className='text-muted-foreground text-sm'>
            {t(
              'Emails are sent with the SMTP configuration above, and the registration link uses the server address from Site Information. Confirm the server address is publicly reachable before enabling automatic sending.'
            )}
          </p>

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable open-source promotion')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Master switch for the scheduled harvest and automatic sending. Manual actions on the Open Source Promotion page still run while it is off.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {enabled && (
            <>
              <FormField
                control={form.control}
                name='githubToken'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('GitHub token')}</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={
                          defaultValues.githubTokenConfigured
                            ? t('Configured — leave empty to keep it')
                            : t('Optional, raises the GitHub API rate limit')
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'A read-only token without scopes is enough. GitHub search is limited to 10 requests per minute when anonymous.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='githubRequestsPerMinute'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('GitHub requests per minute')}</FormLabel>
                    <FormControl>
                      <Input type='number' min={0} max={600} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'The harvest waits between GitHub calls so the run stays inside this budget. 0 uses the GitHub default: 10 per minute without a token, 30 with one.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='keywords'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Search keywords')}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder={t('One keyword per line, empty means no keyword filter')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Keywords are matched against the repository name, description, and README'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SettingsFormGrid>
                <SettingsFormGridItem>
                  <FormField
                    control={form.control}
                    name='minStars'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Minimum stars')}</FormLabel>
                        <FormControl>
                          <Input type='number' min={0} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsFormGridItem>
                <SettingsFormGridItem>
                  <FormField
                    control={form.control}
                    name='maxStars'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Maximum stars')}</FormLabel>
                        <FormControl>
                          <Input type='number' min={0} {...field} />
                        </FormControl>
                        <FormDescription>
                          {t('Small and mid-sized projects are usually below 500')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsFormGridItem>
                <SettingsFormGridItem>
                  <FormField
                    control={form.control}
                    name='activeDays'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Active within (days)')}</FormLabel>
                        <FormControl>
                          <Input type='number' min={1} max={3650} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsFormGridItem>
                <SettingsFormGridItem>
                  <FormField
                    control={form.control}
                    name='maxReposPerRun'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Repositories per run')}</FormLabel>
                        <FormControl>
                          <Input type='number' min={1} max={100} {...field} />
                        </FormControl>
                        <FormDescription>
                          {t('Each repository costs two to four GitHub requests')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsFormGridItem>
                <SettingsFormGridItem>
                  <FormField
                    control={form.control}
                    name='maxAuthorsPerRepo'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Authors per repository')}</FormLabel>
                        <FormControl>
                          <Input type='number' min={1} max={20} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsFormGridItem>
                <SettingsFormGridItem>
                  <FormField
                    control={form.control}
                    name='fetchTime'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Daily harvest time')}</FormLabel>
                        <FormControl>
                          <Input type='time' {...field} />
                        </FormControl>
                        <FormDescription>
                          {t('Uses the server local time zone')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsFormGridItem>
              </SettingsFormGrid>

              <FormField
                control={form.control}
                name='emailWhitelist'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Email whitelist')}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder={t('One address or @domain per line; empty accepts all')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'When set, only exact addresses or matching domains are harvested'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid gap-2'>
                <FormField
                  control={form.control}
                  name='topicChinese'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Use topic:chinese')}</FormLabel>
                        <FormDescription>
                          {t(
                            'Adds the chinese topic to the GitHub search query'
                          )}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='requireChineseProject'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Only chinese projects')}</FormLabel>
                        <FormDescription>
                          {t(
                            'Filters repositories whose description or topics are not chinese'
                          )}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='requireChineseAuthor'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Only chinese authors')}</FormLabel>
                        <FormDescription>
                          {t(
                            'Checks each GitHub profile location; adds one request per author'
                          )}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='includePrAuthors'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Include pull request authors')}</FormLabel>
                        <FormDescription>
                          {t(
                            'Harvests the authors of pull requests in addition to commit authors'
                          )}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='autoSendEnabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Automatic sending')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Sends the invitation emails once per day at the configured time'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />

              <SettingsFormGrid>
                <SettingsFormGridItem>
                  <FormField
                    control={form.control}
                    name='sendTime'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Daily sending time')}</FormLabel>
                        <FormControl>
                          <Input type='time' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsFormGridItem>
                <SettingsFormGridItem>
                  <FormField
                    control={form.control}
                    name='dailySendLimit'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Daily send limit')}</FormLabel>
                        <FormControl>
                          <Input type='number' min={1} max={1000} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsFormGridItem>
                <SettingsFormGridItem>
                  <FormField
                    control={form.control}
                    name='sendIntervalSeconds'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Interval between emails (seconds)')}</FormLabel>
                        <FormControl>
                          <Input type='number' min={5} max={3600} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsFormGridItem>
                <SettingsFormGridItem>
                  <FormField
                    control={form.control}
                    name='rewardAmount'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Reward amount (CNY)')}</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={0}
                            step='0.01'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'Converted with the configured USD exchange rate when credited'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsFormGridItem>
              </SettingsFormGrid>

              <FormField
                control={form.control}
                name='rewardNote'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Extra note in the email')}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder={t('Optional, shown as an extra paragraph')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='emailSubject'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Email subject')}</FormLabel>
                    <FormControl>
                      <Input
                        maxLength={300}
                        placeholder={t(
                          'Leave empty to use the built-in bilingual subject'
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='emailBody'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Email body (HTML)')}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={10}
                        className='font-mono text-xs'
                        placeholder={t(
                          'Leave empty to use the built-in bilingual template'
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Values are HTML-escaped; the template itself is sent as HTML. Available placeholders:'
                      )}
                      <span className='text-foreground mt-1 block font-mono text-xs'>
                        {'{{SystemName}} {{Repository}} {{Contribution}} {{Amount}} {{Link}} {{Note}}'}
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <OpenSourcePromotionEmailPreview />

              <p className='text-muted-foreground text-sm'>
                {t(
                  'Password registration only matches the list when email verification is enabled. GitHub sign-in matches the verified addresses of the GitHub account either way.'
                )}
              </p>
            </>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
