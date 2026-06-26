import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Button, message, Empty, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { sessionAPI } from '../api'

const { Title } = Typography

function HistoryPage({ user }) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      message.warning('请先登录')
      navigate('/')
      return
    }
    loadSessions()
  }, [user, navigate])

  const loadSessions = async () => {
    try {
      const res = await sessionAPI.getAll()
      setSessions(res.data)
    } catch (err) {
      message.error('加载训练记录失败')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: '股票代码',
      dataIndex: 'stock_code',
      render: (v) => v ? v.split('.')[0] : '-',
    },
    {
      title: '训练区间',
      key: 'period',
      render: (_, record) => `${record.start_date} ~ ${record.end_date}`,
    },
    {
      title: '初始资金',
      dataIndex: 'initial_capital',
      render: (v) => `¥${v?.toLocaleString()}`,
    },
    {
      title: '最终资产',
      dataIndex: 'final_capital',
      render: (v) => `¥${v?.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    },
    {
      title: '总收益率',
      dataIndex: 'total_return_pct',
      sorter: (a, b) => a.total_return_pct - b.total_return_pct,
      render: (v) => (
        <span style={{ color: v >= 0 ? '#cf1322' : '#3f8600' }}>
          {v >= 0 ? '+' : ''}{v?.toFixed(2)}%
        </span>
      ),
    },
    {
      title: '年化收益率',
      dataIndex: 'annualized_return_pct',
      render: (v) => (
        <span style={{ color: v >= 0 ? '#cf1322' : '#3f8600' }}>
          {v >= 0 ? '+' : ''}{v?.toFixed(2)}%
        </span>
      ),
    },
    {
      title: '最大回撤',
      dataIndex: 'max_drawdown_pct',
      render: (v) => <span style={{ color: '#3f8600' }}>-{v?.toFixed(2)}%</span>,
    },
    {
      title: '交易次数',
      dataIndex: 'total_trades',
    },
    {
      title: '胜率',
      dataIndex: 'win_rate',
      render: (v) => `${v?.toFixed(1)}%`,
    },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Card
        title={<Title level={4} style={{ margin: 0 }}>📚 历史训练记录</Title>}
        extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>}
      >
        {sessions.length === 0 && !loading ? (
          <Empty description="暂无训练记录" />
        ) : (
          <Table
            dataSource={sessions}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>
    </div>
  )
}

export default HistoryPage
