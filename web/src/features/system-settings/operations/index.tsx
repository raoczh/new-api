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
import { useStatus } from '@/hooks/use-status'

import { SettingsPage } from '../components/settings-page'
import type { OperationsSettings } from '../types'
import {
  OPERATIONS_DEFAULT_SECTION,
  getOperationsSectionContent,
  getOperationsSectionMeta,
} from './section-registry.tsx'

const defaultOperationsSettings: OperationsSettings = {
  DefaultCollapseSidebar: false,
  DemoSiteEnabled: false,
  SelfUseModeEnabled: false,
  QuotaRemindEnabled: true,
  QuotaRemindThreshold: '',
  EmailProvider: 'smtp',
  ResendApiKey: '',
  ResendKeyConfigured: false,
  ResendFrom: '',
  SMTPServer: '',
  SMTPPort: '',
  SMTPAccount: '',
  SMTPFrom: '',
  SMTPToken: '',
  SMTPSSLEnabled: false,
  SMTPStartTLSEnabled: false,
  SMTPInsecureSkipVerify: false,
  SMTPForceAuthLogin: false,
  WorkerUrl: '',
  WorkerValidKey: '',
  WorkerAllowHttpImageRequestEnabled: false,
  LogConsumeEnabled: false,
  'log_setting.user_export_enabled': true,
  'log_setting.max_range_days': 365,
  'performance_setting.disk_cache_enabled': false,
  'performance_setting.disk_cache_threshold_mb': 10,
  'performance_setting.disk_cache_max_size_mb': 1024,
  'performance_setting.disk_cache_path': '',
  'performance_setting.monitor_enabled': false,
  'performance_setting.monitor_cpu_threshold': 90,
  'performance_setting.monitor_memory_threshold': 90,
  'performance_setting.monitor_disk_threshold': 95,
  'perf_metrics_setting.enabled': true,
  'perf_metrics_setting.flush_interval': 5,
  'perf_metrics_setting.bucket_time': 'hour',
  'perf_metrics_setting.retention_days': 0,
  GitHubTokenConfigured: false,
  'open_source_promotion.enabled': false,
  'open_source_promotion.keywords': [],
  'open_source_promotion.topic_chinese': true,
  'open_source_promotion.min_stars': 5,
  'open_source_promotion.max_stars': 500,
  'open_source_promotion.active_days': 180,
  'open_source_promotion.max_repos_per_run': 20,
  'open_source_promotion.max_authors_per_repo': 3,
  'open_source_promotion.include_pr_authors': true,
  'open_source_promotion.require_chinese_project': true,
  'open_source_promotion.require_chinese_author': false,
  'open_source_promotion.email_whitelist': [],
  'open_source_promotion.github_requests_per_minute': 0,
  'open_source_promotion.auto_send_enabled': false,
  'open_source_promotion.fetch_time': '03:00',
  'open_source_promotion.send_time': '10:00',
  'open_source_promotion.daily_send_limit': 50,
  'open_source_promotion.send_interval_seconds': 30,
  'open_source_promotion.reward_amount': 10,
  'open_source_promotion.reward_note': '',
  'open_source_promotion.email_subject': '',
  'open_source_promotion.email_body': '',
}

export function OperationsSettings() {
  const { status } = useStatus()

  return (
    <SettingsPage
      routePath='/_authenticated/system-settings/operations/$section'
      defaultSettings={defaultOperationsSettings}
      defaultSection={OPERATIONS_DEFAULT_SECTION}
      getSectionContent={getOperationsSectionContent}
      getSectionMeta={getOperationsSectionMeta}
      extraArgs={[
        status?.version as string | undefined,
        status?.start_time as number | null | undefined,
      ]}
      loadingMessage='Loading maintenance settings...'
    />
  )
}
