import React, { useState, useEffect } from 'react'
import { Card, Button, message, Typography, Tag } from 'antd'
import { CrownOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { vipAPI } from '../api'

const { Title, Text, Paragraph } = Typography

function VipPage({ user }) {
  const [status, setStatus] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    if (user) loadStatus()
  }, [user])

  const loadStatus = async () => {
    try {
      const res = await vipAPI.getStatus()
      setStatus(res.data)
    } catch (err) {}
  }

  const handleActivate = async () => {
    setActivating(true)
    try {
      await vipAPI.activateVip()
      message.success('VIP已激活，有效期30天！')
      setShowQR(false)
      loadStatus()
    } catch (err) {
      message.error('激活失败')
    } finally {
      setActivating(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Card style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', textAlign: 'center' }}>
        <CrownOutlined style={{ fontSize: 48, color: '#fbbf24', marginBottom: 16 }} />
        <Title level={3} style={{ color: 'var(--text-primary)' }}>VIP会员</Title>
        <Paragraph style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          解锁无限次模拟训练，提升交易水平
        </Paragraph>

        {status?.is_vip ? (
          <div>
            <Tag color="gold" style={{ fontSize: 16, padding: '6px 16px' }}>
              <CrownOutlined /> 当前为VIP会员
            </Tag>
            <div style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
              到期时间：{status.vip_expire_at?.slice(0, 10)}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 13 }}>
              普通用户每天限制 <strong style={{ color: '#f87171' }}>3次</strong> 模拟训练
              {status && <span>（今日已用 {status.today_training_count} 次）</span>}
            </div>
          </div>
        )}

        <Card
          style={{ marginTop: 24, background: 'linear-gradient(135deg, #1e1b4b, #312e81)', border: 'none' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: '#fbbf24', fontSize: 14, fontWeight: 600 }}>月度VIP</div>
              <div style={{ color: '#e2e8f0', fontSize: 28, fontWeight: 800, margin: '4px 0' }}>¥28<span style={{ fontSize: 14, fontWeight: 400 }}>/月</span></div>
              <div style={{ color: '#a5b4fc', fontSize: 12 }}>无限次训练 · 全部功能</div>
            </div>
            <div style={{ textAlign: 'left', color: '#c7d2fe', fontSize: 13 }}>
              <div><CheckCircleOutlined style={{ color: '#4ade80', marginRight: 6 }} />无限模拟训练</div>
              <div><CheckCircleOutlined style={{ color: '#4ade80', marginRight: 6 }} />社区发帖</div>
              <div><CheckCircleOutlined style={{ color: '#4ade80', marginRight: 6 }} />完整历史数据</div>
            </div>
          </div>
        </Card>

        {!showQR ? (
          <Button
            type="primary"
            size="large"
            block
            style={{ marginTop: 24, height: 48, fontSize: 16, fontWeight: 600, borderRadius: 10 }}
            onClick={() => {
              if (!user) { message.warning('请先登录'); return }
              setShowQR(true)
            }}
          >
            {status?.is_vip ? '续费VIP' : '开通VIP'}
          </Button>
        ) : (
          <div style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
              请扫描下方收款码支付 ¥28
            </div>
            <img
              src="/static/28.jpg"
              alt="收款码"
              style={{ width: 220, height: 220, borderRadius: 8, border: '2px solid var(--border)' }}
            />
            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                size="large"
                onClick={handleActivate}
                loading={activating}
                style={{ marginRight: 12 }}
              >
                我已支付，激活VIP
              </Button>
              <Button onClick={() => setShowQR(false)}>取消</Button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              支付后点击"我已支付"按钮激活
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default VipPage
