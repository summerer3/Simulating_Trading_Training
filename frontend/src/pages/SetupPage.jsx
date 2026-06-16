import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DatePicker, Select, Button, InputNumber, message } from 'antd'
import { PlayCircleOutlined, LineChartOutlined, ThunderboltOutlined, TrophyOutlined, BarChartOutlined } from '@ant-design/icons'
import { dataAPI, vipAPI } from '../api'
import dayjs from 'dayjs'

const features = [
  { icon: <LineChartOutlined />, title: '真实历史数据', desc: '基于2006-2026年A股真实日线数据，还原真实市场环境' },
  { icon: <ThunderboltOutlined />, title: '快速决策训练', desc: '每个交易日做出买入/卖出/观望决策，键盘快捷键操作' },
  { icon: <TrophyOutlined />, title: '绩效评估', desc: '总收益、年化收益、最大回撤、胜率等专业指标评价' },
  { icon: <BarChartOutlined />, title: '完整K线图', desc: '支持拖动缩放的专业K线图，查看完整历史走势' },
]

function SetupPage({ user }) {
  const navigate = useNavigate()
  const [startDate, setStartDate] = useState(null)
  const [selectedStock, setSelectedStock] = useState(null)
  const [stockOptions, setStockOptions] = useState([])
  const [initialCapital, setInitialCapital] = useState(1000000)
  const [loading, setLoading] = useState(false)

  const handleSearch = async (value) => {
    if (!value || value.length < 2) {
      setStockOptions([])
      return
    }
    try {
      const res = await dataAPI.searchStocks(value)
      setStockOptions(res.data.map(s => ({
        label: `${s.code_short} (${s.market === 'SZ' ? '深圳' : '上海'})`,
        value: s.stock_code,
      })))
    } catch (err) {
      console.error(err)
    }
  }

  const handleStart = async () => {
    if (!startDate) {
      message.warning('请选择开始日期')
      return
    }
    if (!selectedStock) {
      message.warning('请选择股票')
      return
    }

    // VIP训练限制检查（暂时禁用）
    // if (user) {
    //   try {
    //     const checkRes = await vipAPI.checkTraining()
    //     if (!checkRes.data.allowed) {
    //       message.warning(`今日免费训练次数已用完（3次），开通VIP享受无限训练`)
    //       navigate('/vip')
    //       return
    //     }
    //   } catch (err) {}
    // }

    setLoading(true)
    try {
      const dateStr = startDate.format('YYYY-MM-DD')
      const res = await dataAPI.getTradingDays(dateStr)
      if (res.data.length === 0) {
        message.error('该日期之后没有交易日数据')
        return
      }
      sessionStorage.setItem('tradingConfig', JSON.stringify({
        stockCode: selectedStock,
        startDate: dateStr,
        tradingDays: res.data,
        initialCapital: initialCapital,
      }))
      navigate('/trading')
    } catch (err) {
      message.error('获取交易日数据失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="setup-page">
      {/* Top Bar: Title left, Form right */}
      <section className="setup-topbar">
        <div className="setup-topbar-left">
          <h1>A股模拟交易训练</h1>
          <p>用真实历史数据磨练交易直觉，无风险提升实战能力</p>
        </div>
        <div className="setup-topbar-right">
          <div className="form-inline-item">
            <span className="form-inline-label">开始日期</span>
            <DatePicker
              style={{ width: 170 }}
              value={startDate}
              onChange={setStartDate}
              placeholder="选择日期"
              disabledDate={(current) => current && current > dayjs()}
            />
          </div>
          <div className="form-inline-item">
            <span className="form-inline-label">股票</span>
            <Select
              showSearch
              style={{ width: 200 }}
              placeholder="输入代码搜索"
              value={selectedStock}
              onChange={setSelectedStock}
              onSearch={handleSearch}
              options={stockOptions}
              filterOption={false}
              notFoundContent="输入代码搜索"
            />
          </div>
          <div className="form-inline-item">
            <span className="form-inline-label">初始资金</span>
            <InputNumber
              style={{ width: 160 }}
              value={initialCapital}
              onChange={setInitialCapital}
              min={10000}
              max={100000000}
              step={100000}
              formatter={v => `¥${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/¥\s?|(,*)/g, '')}
            />
          </div>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleStart}
            loading={loading}
            className="start-btn"
          >
            开始训练
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        {features.map((f, i) => (
          <div key={i} className="feature-card">
            <div className="feature-icon">{f.icon}</div>
            <h3 className="feature-title">{f.title}</h3>
            <p className="feature-desc">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <p>A股模拟交易训练系统 · 仅供学习交流使用</p>
      </footer>
    </div>
  )
}

export default SetupPage
