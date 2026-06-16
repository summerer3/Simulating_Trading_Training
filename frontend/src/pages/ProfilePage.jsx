import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Button, message, Empty, Typography, Descriptions, Modal, Tag, Timeline, Popconfirm } from 'antd'
import { ArrowLeftOutlined, UserOutlined, DeleteOutlined } from '@ant-design/icons'
import { sessionAPI } from '../api'

const { Title, Text } = Typography

function ProfilePage({ user }) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [deleting, setDeleting] = useState(false)

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

  const handleBatchDelete = async () => {
    setDeleting(true)
    try {
      await sessionAPI.batchDelete(selectedRowKeys)
      message.success(`已删除 ${selectedRowKeys.length} 条记录`)
      setSelectedRowKeys([])
      loadSessions()
    } catch (err) {
      message.error('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
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
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button size="small" onClick={() => setSelectedSession(record)}>详情</Button>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <div>
            <Title level={3} style={{ margin: 0 }}>{user?.username}</Title>
            <Text type="secondary">共完成 {sessions.length} 次训练</Text>
          </div>
          <Button style={{ marginLeft: 'auto' }} icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            返回首页
          </Button>
        </div>
      </Card>

      <Card title="📚 训练记录" extra={
        selectedRowKeys.length > 0 && (
          <Popconfirm
            title={`确认删除 ${selectedRowKeys.length} 条记录？`}
            onConfirm={handleBatchDelete}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} loading={deleting}>
              删除选中 ({selectedRowKeys.length})
            </Button>
          </Popconfirm>
        )
      }>
        {sessions.length === 0 && !loading ? (
          <Empty description="暂无训练记录，快去开始第一次训练吧！" />
        ) : (
          <Table
            dataSource={sessions}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
          />
        )}
      </Card>

      <Modal
        title="训练详情"
        open={!!selectedSession}
        onCancel={() => setSelectedSession(null)}
        footer={<Button onClick={() => setSelectedSession(null)}>关闭</Button>}
        width={700}
      >
        {selectedSession && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="训练区间">
                {selectedSession.start_date} ~ {selectedSession.end_date}
              </Descriptions.Item>
              <Descriptions.Item label="初始资金">
                ¥{selectedSession.initial_capital?.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="最终资产">
                ¥{selectedSession.final_capital?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Descriptions.Item>
              <Descriptions.Item label="总收益率">
                <span style={{ color: selectedSession.total_return_pct >= 0 ? '#cf1322' : '#3f8600' }}>
                  {selectedSession.total_return_pct >= 0 ? '+' : ''}{selectedSession.total_return_pct?.toFixed(2)}%
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="年化收益率">
                <span style={{ color: selectedSession.annualized_return_pct >= 0 ? '#cf1322' : '#3f8600' }}>
                  {selectedSession.annualized_return_pct >= 0 ? '+' : ''}{selectedSession.annualized_return_pct?.toFixed(2)}%
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="最大回撤">
                <span style={{ color: '#3f8600' }}>-{selectedSession.max_drawdown_pct?.toFixed(2)}%</span>
              </Descriptions.Item>
              <Descriptions.Item label="总交易次数">{selectedSession.total_trades}</Descriptions.Item>
              <Descriptions.Item label="胜率">{selectedSession.win_rate?.toFixed(1)}%</Descriptions.Item>
            </Descriptions>

            {selectedSession.trade_history && selectedSession.trade_history.length > 0 && (
              <Card title="交易明细" size="small">
                <Timeline
                  items={selectedSession.trade_history.map((t, i) => ({
                    color: t.action === 'buy' ? 'red' : 'green',
                    children: (
                      <div key={i}>
                        <Tag color={t.action === 'buy' ? 'red' : 'green'}>
                          {t.action === 'buy' ? '买入' : '卖出'}
                        </Tag>
                        {t.date} | {t.shares}股 @ ¥{t.price?.toFixed(2)}
                        {t.profit !== undefined && (
                          <span style={{ marginLeft: 8, color: t.profit >= 0 ? '#cf1322' : '#3f8600' }}>
                            {t.profit >= 0 ? '+' : ''}¥{t.profit?.toFixed(0)}
                          </span>
                        )}
                      </div>
                    ),
                  }))}
                />
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ProfilePage
