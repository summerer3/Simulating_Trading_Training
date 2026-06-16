import React, { useState, useEffect } from 'react'
import { Card, Button, List, Tag, Modal, Form, Input, Select, message, Typography, Empty } from 'antd'
import { PlusOutlined, TrophyOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { communityAPI, sessionAPI } from '../api'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

function CommunityPage({ user }) {
  const [posts, setPosts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [sessions, setSessions] = useState([])
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadPosts() }, [page])

  const loadPosts = async () => {
    setLoading(true)
    try {
      const res = await communityAPI.getPosts(page)
      setPosts(res.data.posts)
      setTotal(res.data.total)
    } catch (err) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = async () => {
    if (!user) { message.warning('请先登录'); return }
    setShowCreate(true)
    try {
      const res = await sessionAPI.getAll()
      setSessions(res.data)
    } catch (err) {}
  }

  const handleCreate = async (values) => {
    setSubmitting(true)
    try {
      await communityAPI.createPost(values)
      message.success('发布成功')
      setShowCreate(false)
      form.resetFields()
      loadPosts()
    } catch (err) {
      message.error(err.response?.data?.detail || '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = async (postId) => {
    try {
      const res = await communityAPI.getPost(postId)
      setShowDetail(res.data)
    } catch (err) {
      message.error('加载失败')
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: 'var(--text-primary)' }}>社区</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>发帖</Button>
      </div>

      {posts.length === 0 && !loading ? (
        <Empty description="还没有帖子，来发第一帖吧！" />
      ) : (
        <List
          loading={loading}
          dataSource={posts}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
          renderItem={item => (
            <Card
              hoverable
              style={{ marginBottom: 12, background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              onClick={() => openDetail(item.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text strong style={{ fontSize: 16 }}>{item.title}</Text>
                  {item.has_session && <Tag color="purple" style={{ marginLeft: 8 }}>附交易记录</Tag>}
                  <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                    {item.content}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                {item.username} · {item.created_at?.slice(0, 10)}
              </div>
            </Card>
          )}
        />
      )}

      {/* 发帖弹窗 */}
      <Modal
        title="发布帖子"
        open={showCreate}
        onCancel={() => setShowCreate(false)}
        footer={null}
        centered
      >
        <Form form={form} onFinish={handleCreate} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, min: 2, message: '标题至少2字' }]}>
            <Input placeholder="输入帖子标题" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, min: 5, message: '内容至少5字' }]}>
            <TextArea rows={4} placeholder="分享你的交易心得..." />
          </Form.Item>
          <Form.Item name="session_id" label="附加训练记录（可选）">
            <Select allowClear placeholder="选择要分享的训练记录">
              {sessions.map(s => (
                <Select.Option key={s.id} value={s.id}>
                  {s.start_date}~{s.end_date} | 收益{s.total_return_pct >= 0 ? '+' : ''}{s.total_return_pct?.toFixed(1)}%
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>发布</Button>
        </Form>
      </Modal>

      {/* 帖子详情弹窗 */}
      <Modal
        title={showDetail?.title}
        open={!!showDetail}
        onCancel={() => setShowDetail(null)}
        footer={<Button onClick={() => setShowDetail(null)}>关闭</Button>}
        width={700}
        centered
      >
        {showDetail && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {showDetail.username} · {showDetail.created_at?.slice(0, 10)}
            </div>
            <Paragraph style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
              {showDetail.content}
            </Paragraph>
            {showDetail.session && (
              <Card size="small" title={<><TrophyOutlined /> 交易记录</>} style={{ marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 13 }}>
                  <div>区间: {showDetail.session.start_date} ~ {showDetail.session.end_date}</div>
                  <div>总收益: <span style={{ color: showDetail.session.total_return_pct >= 0 ? '#f87171' : '#4ade80' }}>
                    {showDetail.session.total_return_pct >= 0 ? '+' : ''}{showDetail.session.total_return_pct?.toFixed(2)}%
                  </span></div>
                  <div>年化: <span style={{ color: showDetail.session.annualized_return_pct >= 0 ? '#f87171' : '#4ade80' }}>
                    {showDetail.session.annualized_return_pct >= 0 ? '+' : ''}{showDetail.session.annualized_return_pct?.toFixed(2)}%
                  </span></div>
                  <div>最大回撤: -{showDetail.session.max_drawdown_pct?.toFixed(2)}%</div>
                  <div>交易次数: {showDetail.session.total_trades}</div>
                  <div>胜率: {showDetail.session.win_rate?.toFixed(1)}%</div>
                </div>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default CommunityPage
