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
import { SystemBehaviorSection } from '../general/system-behavior-section'
import { EmailSettingsSection } from '../integrations/email-settings-section'
import { MonitoringSettingsSection } from '../integrations/monitoring-settings-section'
import { WorkerSettingsSection } from '../integrations/worker-settings-section'
import { LogSettingsSection } from '../maintenance/log-settings-section'
import { PerformanceSection } from '../maintenance/performance-section'
import { UpdateCheckerSection } from '../maintenance/update-checker-section'
import type { OperationsSettings } from '../types'
import { createSectionRegistry } from '../utils/section-registry'
import { OpenSourcePromotionSettingsSection } from './open-source-promotion-settings-section'

const OPERATIONS_SECTIONS = [
  {
    id: 'behavior',
    titleKey: 'System Behavior',
    build: (settings: OperationsSettings) => (
      <SystemBehaviorSection
        defaultValues={{
          DefaultCollapseSidebar: settings.DefaultCollapseSidebar,
          DemoSiteEnabled: settings.DemoSiteEnabled,
          SelfUseModeEnabled: settings.SelfUseModeEnabled,
        }}
      />
    ),
  },
  {
    id: 'alerts',
    titleKey: 'Model performance metrics',
    build: (settings: OperationsSettings) => (
      <MonitoringSettingsSection
        defaultValues={{
          'perf_metrics_setting.enabled':
            settings['perf_metrics_setting.enabled'] ?? true,
          'perf_metrics_setting.flush_interval':
            settings['perf_metrics_setting.flush_interval'] ?? 5,
          'perf_metrics_setting.bucket_time':
            settings['perf_metrics_setting.bucket_time'] ?? 'hour',
          'perf_metrics_setting.retention_days':
            settings['perf_metrics_setting.retention_days'] ?? 0,
        }}
      />
    ),
  },
  {
    id: 'email',
    titleKey: 'Email & Notifications',
    build: (settings: OperationsSettings) => (
      <EmailSettingsSection
        defaultValues={{
          QuotaRemindEnabled: settings.QuotaRemindEnabled,
          QuotaRemindThreshold: settings.QuotaRemindThreshold,
          EmailProvider: settings.EmailProvider,
          ResendApiKey: settings.ResendApiKey,
          ResendKeyConfigured: settings.ResendKeyConfigured,
          ResendFrom: settings.ResendFrom,
          SMTPServer: settings.SMTPServer,
          SMTPPort: settings.SMTPPort,
          SMTPAccount: settings.SMTPAccount,
          SMTPFrom: settings.SMTPFrom,
          SMTPToken: settings.SMTPToken,
          SMTPSSLEnabled: settings.SMTPSSLEnabled,
          SMTPStartTLSEnabled: settings.SMTPStartTLSEnabled,
          SMTPInsecureSkipVerify: settings.SMTPInsecureSkipVerify,
          SMTPForceAuthLogin: settings.SMTPForceAuthLogin,
        }}
      />
    ),
  },
  {
    id: 'worker',
    titleKey: 'Worker Proxy',
    build: (settings: OperationsSettings) => (
      <WorkerSettingsSection
        defaultValues={{
          WorkerUrl: settings.WorkerUrl,
          WorkerValidKey: settings.WorkerValidKey,
          WorkerAllowHttpImageRequestEnabled:
            settings.WorkerAllowHttpImageRequestEnabled,
        }}
      />
    ),
  },
  {
    id: 'logs',
    titleKey: 'Log Maintenance',
    build: (settings: OperationsSettings) => (
      <LogSettingsSection
        defaultValues={{
          LogConsumeEnabled: Boolean(settings.LogConsumeEnabled),
          'log_setting.user_export_enabled':
            settings['log_setting.user_export_enabled'] ?? true,
          'log_setting.max_range_days':
            settings['log_setting.max_range_days'] ?? 365,
        }}
      />
    ),
  },
  {
    id: 'performance',
    titleKey: 'Performance',
    build: (settings: OperationsSettings) => (
      <PerformanceSection
        defaultValues={{
          'performance_setting.disk_cache_enabled':
            settings['performance_setting.disk_cache_enabled'] ?? false,
          'performance_setting.disk_cache_threshold_mb':
            settings['performance_setting.disk_cache_threshold_mb'] ?? 10,
          'performance_setting.disk_cache_max_size_mb':
            settings['performance_setting.disk_cache_max_size_mb'] ?? 1024,
          'performance_setting.disk_cache_path':
            settings['performance_setting.disk_cache_path'] ?? '',
          'performance_setting.monitor_enabled':
            settings['performance_setting.monitor_enabled'] ?? false,
          'performance_setting.monitor_cpu_threshold':
            settings['performance_setting.monitor_cpu_threshold'] ?? 90,
          'performance_setting.monitor_memory_threshold':
            settings['performance_setting.monitor_memory_threshold'] ?? 90,
          'performance_setting.monitor_disk_threshold':
            settings['performance_setting.monitor_disk_threshold'] ?? 95,
        }}
      />
    ),
  },
  {
    id: 'open-source-promotion',
    titleKey: 'Open source promotion',
    build: (settings: OperationsSettings) => (
      <OpenSourcePromotionSettingsSection
        defaultValues={{
          enabled: settings['open_source_promotion.enabled'] ?? false,
          githubToken: '',
          githubTokenConfigured:
            settings.GitHubTokenConfigured ?? false,
          githubRequestsPerMinute:
            settings['open_source_promotion.github_requests_per_minute'] ?? 0,
          keywords: settings['open_source_promotion.keywords'] ?? [],
          topicChinese:
            settings['open_source_promotion.topic_chinese'] ?? true,
          minStars: settings['open_source_promotion.min_stars'] ?? 5,
          maxStars: settings['open_source_promotion.max_stars'] ?? 500,
          activeDays: settings['open_source_promotion.active_days'] ?? 180,
          maxReposPerRun:
            settings['open_source_promotion.max_repos_per_run'] ?? 20,
          maxAuthorsPerRepo:
            settings['open_source_promotion.max_authors_per_repo'] ?? 3,
          includePrAuthors:
            settings['open_source_promotion.include_pr_authors'] ?? true,
          requireChineseProject:
            settings['open_source_promotion.require_chinese_project'] ?? true,
          requireChineseAuthor:
            settings['open_source_promotion.require_chinese_author'] ?? false,
          emailWhitelist:
            settings['open_source_promotion.email_whitelist'] ?? [],
          autoSendEnabled:
            settings['open_source_promotion.auto_send_enabled'] ?? false,
          fetchTime: settings['open_source_promotion.fetch_time'] ?? '03:00',
          sendTime: settings['open_source_promotion.send_time'] ?? '10:00',
          dailySendLimit:
            settings['open_source_promotion.daily_send_limit'] ?? 50,
          sendIntervalSeconds:
            settings['open_source_promotion.send_interval_seconds'] ?? 30,
          rewardAmount: settings['open_source_promotion.reward_amount'] ?? 10,
          rewardNote: settings['open_source_promotion.reward_note'] ?? '',
          emailSubject: settings['open_source_promotion.email_subject'] ?? '',
          emailBody: settings['open_source_promotion.email_body'] ?? '',
        }}
      />
    ),
  },
  {
    id: 'update-checker',
    titleKey: 'System maintenance',
    build: (
      _settings: OperationsSettings,
      currentVersion?: string | null,
      startTime?: number | null
    ) => (
      <UpdateCheckerSection
        currentVersion={currentVersion}
        startTime={startTime}
      />
    ),
  },
] as const

export type OperationsSectionId = (typeof OPERATIONS_SECTIONS)[number]['id']

const operationsRegistry = createSectionRegistry<
  OperationsSectionId,
  OperationsSettings,
  [string | null | undefined, number | null | undefined]
>({
  sections: OPERATIONS_SECTIONS,
  defaultSection: 'behavior',
  basePath: '/system-settings/operations',
  urlStyle: 'path',
})

export const OPERATIONS_SECTION_IDS = operationsRegistry.sectionIds
export const OPERATIONS_DEFAULT_SECTION = operationsRegistry.defaultSection
export const getOperationsSectionNavItems =
  operationsRegistry.getSectionNavItems
export const getOperationsSectionContent = operationsRegistry.getSectionContent
export const getOperationsSectionMeta = operationsRegistry.getSectionMeta
