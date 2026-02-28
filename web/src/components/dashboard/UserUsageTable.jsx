/*
Copyright (C) 2025 QuantumNous

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

import React, { useMemo, useState } from 'react';
import { Card, Table, Input, Empty } from '@douyinfe/semi-ui';
import { Users, Search } from 'lucide-react';
import { renderQuota } from '../../helpers';

const UserUsageTable = ({ data, loading, CARD_PROPS, t }) => {
  const [searchValue, setSearchValue] = useState('');

  const filteredData = useMemo(() => {
    if (!searchValue) return data;
    return data.filter((item) =>
      item.username.toLowerCase().includes(searchValue.toLowerCase()),
    );
  }, [data, searchValue]);

  const columns = useMemo(
    () => [
      {
        title: t('用户名'),
        dataIndex: 'username',
        key: 'username',
        sorter: (a, b) => a.username.localeCompare(b.username),
      },
      {
        title: t('请求次数'),
        dataIndex: 'count',
        key: 'count',
        sorter: (a, b) => a.count - b.count,
        render: (val) => (val || 0).toLocaleString(),
      },
      {
        title: t('消耗额度'),
        dataIndex: 'quota',
        key: 'quota',
        sorter: (a, b) => a.quota - b.quota,
        defaultSortOrder: 'descend',
        render: (val) => renderQuota(val || 0, 2),
      },
      {
        title: t('消耗Tokens'),
        dataIndex: 'token_used',
        key: 'token_used',
        sorter: (a, b) => a.token_used - b.token_used,
        render: (val) => (val || 0).toLocaleString(),
      },
    ],
    [t],
  );

  return (
    <Card
      {...CARD_PROPS}
      className='!rounded-2xl'
      title={
        <div className='flex items-center justify-between w-full'>
          <div className='flex items-center gap-2'>
            <Users size={16} />
            {t('用户使用量排行')}
          </div>
          <Input
            prefix={<Search size={14} />}
            placeholder={t('搜索用户')}
            value={searchValue}
            onChange={setSearchValue}
            style={{ width: 200 }}
            showClear
          />
        </div>
      }
    >
      <Table
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        rowKey='user_id'
        pagination={{ pageSize: 10, showSizeChanger: true }}
        size='small'
        empty={<Empty description={t('暂无数据')} />}
      />
    </Card>
  );
};

export default UserUsageTable;
