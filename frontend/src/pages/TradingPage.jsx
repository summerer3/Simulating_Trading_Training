import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Button, Tag, Radio, message, Spin, Typography } from 'antd'
import { dataAPI, sessionAPI } from '../api'
import KLineChart from '../components/KLineChart'

const { Title } = Typography

function TradingPage({ user }) {
  const navigate = useNavigate()
  const [config, setConfig] = useState(null)
  const [currentDayIndex, setCurrentDayIndex] = useState(0)
  const [marketData, setMarketData] = useState([])
  const [loading, setLoading] = useState(true)
  const [position, setPosition] = useState(null)
  const [cash, setCash] = useState(0)
  const [tradeHistory, setTradeHistory] = useState([])
  const [capitalHistory, setCapitalHistory] = useState([])
  const [showSummary, setShowSummary] = useState(false)
  const [selectedStock, setSelectedStock] = useState(null)
  const [positionRatio, setPositionRatio] = useState(1.0)
  const [actionMsg, setActionMsg] = useState(null)
  const tradingRef = useRef(false)

  // 用ref保持最新状态给键盘事件用
  const stateRef = useRef({ config, currentDayIndex, cash, position, positionRatio, loading, showSummary, tradeHistory, capitalHistory, marketData })
  useEffect(() => {
    stateRef.current = { config, currentDayIndex, cash, position, positionRatio, loading, showSummary, tradeHistory, capitalHistory, marketData }
  })

  useEffect(() => {
    const saved = sessionStorage.getItem('tradingConfig')
    if (!saved) { navigate('/'); return }
    const cfg = JSON.parse(saved)
    setConfig(cfg)
    setCash(cfg.initialCapital)
    setCapitalHistory([{ date: cfg.startDate, capital: cfg.initialCapital }])
  }, [])

  useEffect(() => {
    if (config && config.tradingDays[currentDayIndex]) {
      loadMarketData()
    }
  }, [config, currentDayIndex])

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (tradingRef.current) return
      const s = stateRef.current
      if (s.loading || s.showSummary) return

      switch (e.key.toLowerCase()) {
        case 'q': e.preventDefault(); executeAction('buy'); break
        case 'w': e.preventDefault(); executeAction('sell'); break
        case 'e': e.preventDefault(); executeAction('hold'); break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const loadMarketData = async () => {
    if (!config) return
    setLoading(true)
    try {
      const res = await dataAPI.getMarket(config.tradingDays[currentDayIndex])
      setMarketData(res.data)
    } catch (err) {
      message.error('加载市场数据失败')
    } finally {
      setLoading(false)
    }
  }

  const currentDate = config?.tradingDays[currentDayIndex]

  const executeAction = async (action) => {
    const s = stateRef.current
    if (!s.config || tradingRef.current) return
    tradingRef.current = true
    const curDate = s.config.tradingDays[s.currentDayIndex]

    try {
      const priceRes = await dataAPI.getStockPrice(s.config.stockCode, curDate)
      const openPrice = priceRes.data.open
      const closePrice = priceRes.data.close

      let newCash = s.cash
      let newPosition = s.position
      let newTradeHistory = [...s.tradeHistory]
      let msgObj = null

      if (action === 'buy') {
        if (s.position) {
          msgObj = { type: 'warning', text: '已有持仓，无法再买入' }
          tradingRef.current = false
          setActionMsg(msgObj)
          return
        }
        const availableCash = s.cash * s.positionRatio
        const shares = Math.floor(availableCash / openPrice / 100) * 100
        if (shares <= 0) {
          msgObj = { type: 'warning', text: '资金不足' }
          tradingRef.current = false
          setActionMsg(msgObj)
          return
        }
        const cost = shares * openPrice
        newCash = s.cash - cost
        newPosition = { stock_code: s.config.stockCode, shares, avg_cost: openPrice }
        newTradeHistory.push({ date: curDate, action: 'buy', price: openPrice, shares, amount: cost })
        msgObj = { type: 'buy', text: `买入 ${shares}股 @ ¥${openPrice.toFixed(2)}` }
      } else if (action === 'sell') {
        if (!s.position) {
          msgObj = { type: 'warning', text: '没有持仓可卖出' }
          tradingRef.current = false
          setActionMsg(msgObj)
          return
        }
        const sellShares = s.positionRatio === 1.0 ? s.position.shares : Math.floor(s.position.shares / 2 / 100) * 100
        if (sellShares <= 0) {
          msgObj = { type: 'warning', text: '持仓不足一手' }
          tradingRef.current = false
          setActionMsg(msgObj)
          return
        }
        const revenue = sellShares * openPrice
        newCash = s.cash + revenue
        const remaining = s.position.shares - sellShares
        newPosition = remaining > 0 ? { ...s.position, shares: remaining } : null
        const profit = (openPrice - s.position.avg_cost) * sellShares
        newTradeHistory.push({ date: curDate, action: 'sell', price: openPrice, shares: sellShares, amount: revenue, profit })
        msgObj = { type: 'sell', text: `卖出 ${sellShares}股 @ ¥${openPrice.toFixed(2)} (${profit >= 0 ? '+' : ''}${profit.toFixed(0)})` }
      } else {
        msgObj = { type: 'hold', text: '观望 → 下一交易日' }
      }

      // 更新状态
      setCash(newCash)
      setPosition(newPosition)
      setTradeHistory(newTradeHistory)
      setActionMsg(msgObj)

      // 计算总资产
      let totalCapital = newCash
      if (newPosition) totalCapital += newPosition.shares * closePrice

      // 进入下一天
      const nextIndex = s.currentDayIndex + 1
      if (nextIndex >= s.config.tradingDays.length) {
        setCapitalHistory(prev => [...prev, { date: curDate, capital: totalCapital }])
        setShowSummary(true)
      } else {
        setCapitalHistory(prev => [...prev, { date: s.config.tradingDays[nextIndex], capital: totalCapital }])
        setCurrentDayIndex(nextIndex)
      }
    } catch (err) {
      setActionMsg({ type: 'warning', text: '当日无数据（停牌），跳到下一天' })
      const nextIndex = stateRef.current.currentDayIndex + 1
      if (nextIndex >= stateRef.current.config.tradingDays.length) {
        setShowSummary(true)
      } else {
        setCurrentDayIndex(nextIndex)
      }
    } finally {
      tradingRef.current = false
    }
  }

  const endTraining = () => setShowSummary(true)

  const calculateSummary = () => {
    if (!config) return null
    const initial = config.initialCapital
    let finalCapital = cash
    if (position) {
      const lastItem = marketData.find(m => m.stock_code === config.stockCode)
      finalCapital += position.shares * (lastItem?.current_price || position.avg_cost)
    }
    const totalReturn = ((finalCapital - initial) / initial) * 100
    const startDate = config.tradingDays[0]
    const endDate = config.tradingDays[currentDayIndex] || config.tradingDays[config.tradingDays.length - 1]
    const dayCount = Math.max(1, (new Date(endDate) - new Date(startDate)) / (1000 * 86400))
    const annualizedReturn = dayCount >= 1 ? (Math.pow(finalCapital / initial, 365 / dayCount) - 1) * 100 : 0
    let maxDrawdown = 0, peak = capitalHistory[0]?.capital || initial
    for (const item of capitalHistory) {
      if (item.capital > peak) peak = item.capital
      const dd = (peak - item.capital) / peak * 100
      if (dd > maxDrawdown) maxDrawdown = dd
    }
    const sellTrades = tradeHistory.filter(t => t.action === 'sell')
    const winRate = sellTrades.length > 0 ? (sellTrades.filter(t => t.profit > 0).length / sellTrades.length * 100) : 0
    return { startDate, endDate, initialCapital: initial, finalCapital, totalReturn, annualizedReturn, maxDrawdown, totalTrades: tradeHistory.length, winRate }
  }

  const handleSaveSummary = async () => {
    const summary = calculateSummary()
    if (!summary) return
    if (!user) { message.info('未登录，训练结果不会保存'); navigate('/'); return }
    try {
      await sessionAPI.save({
        start_date: summary.startDate, end_date: summary.endDate,
        initial_capital: summary.initialCapital, final_capital: summary.finalCapital,
        total_return_pct: summary.totalReturn, annualized_return_pct: summary.annualizedReturn,
        max_drawdown_pct: summary.maxDrawdown, total_trades: summary.totalTrades,
        win_rate: summary.winRate, trade_history: tradeHistory,
      })
      message.success('训练结果已保存')
    } catch (err) { message.error('保存失败') }
    navigate('/')
  }

  const columns = [
    { title: '代码', dataIndex: 'stock_code', key: 'stock_code', width: 90,
      render: (text) => <a onClick={(e) => { e.stopPropagation(); setSelectedStock(text) }}>{text?.split('.')[0]}</a> },
    { title: '价格', dataIndex: 'current_price', key: 'current_price', width: 70,
      sorter: (a, b) => a.current_price - b.current_price, render: (v) => v?.toFixed(2) },
    { title: '涨跌%', dataIndex: 'prev_change_pct', key: 'prev_change_pct', width: 80,
      sorter: (a, b) => a.prev_change_pct - b.prev_change_pct, defaultSortOrder: 'descend',
      render: (v) => <span style={{ color: v > 0 ? '#cf1322' : v < 0 ? '#3f8600' : '#666' }}>{v > 0 ? '+' : ''}{v?.toFixed(2)}%</span> },
    { title: '市值(亿)', dataIndex: 'market_cap', key: 'market_cap', width: 80,
      sorter: (a, b) => (a.market_cap || 0) - (b.market_cap || 0), render: (v) => v ? v.toFixed(1) : '-' },
  ]

  if (!config) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Spin size="large" /></div>

  if (!currentDate) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Spin size="large" /></div>

  // 总结页面
  if (showSummary) {
    const summary = calculateSummary()
    if (!summary) return <Spin />
    return (
      <div className="summary-card">
        <Card title="📊 训练结果总结">
          <div className="stat-grid">
            <div className="stat-item"><div className="label">总收益率</div><div className={`value ${summary.totalReturn >= 0 ? 'positive' : 'negative'}`}>{summary.totalReturn >= 0 ? '+' : ''}{summary.totalReturn.toFixed(2)}%</div></div>
            <div className="stat-item"><div className="label">年化收益率</div><div className={`value ${summary.annualizedReturn >= 0 ? 'positive' : 'negative'}`}>{summary.annualizedReturn >= 0 ? '+' : ''}{summary.annualizedReturn.toFixed(2)}%</div></div>
            <div className="stat-item"><div className="label">最大回撤</div><div className="value negative">-{summary.maxDrawdown.toFixed(2)}%</div></div>
            <div className="stat-item"><div className="label">初始资金</div><div className="value">¥{summary.initialCapital.toLocaleString()}</div></div>
            <div className="stat-item"><div className="label">最终资产</div><div className={`value ${summary.finalCapital >= summary.initialCapital ? 'positive' : 'negative'}`}>¥{summary.finalCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
            <div className="stat-item"><div className="label">交易次数</div><div className="value">{summary.totalTrades}</div></div>
            <div className="stat-item"><div className="label">胜率</div><div className="value">{summary.winRate.toFixed(1)}%</div></div>
            <div className="stat-item"><div className="label">区间</div><div className="value" style={{ fontSize: 14 }}>{summary.startDate} ~ {summary.endDate}</div></div>
          </div>
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Button type="primary" size="large" onClick={handleSaveSummary}>{user ? '保存并返回' : '返回首页'}</Button>
          </div>
        </Card>
      </div>
    )
  }

  const displayStock = selectedStock || config.stockCode
  const totalAsset = cash + (position ? position.shares * (marketData.find(m => m.stock_code === position?.stock_code)?.current_price || position.avg_cost) : 0)
  const profitPct = ((totalAsset - config.initialCapital) / config.initialCapital * 100)

  return (
    <div className="trading-page">
      {/* 顶部信息栏 */}
      <div className="trading-topbar">
        <div className="topbar-left">
          <span className="topbar-date">📅 {currentDate}</span>
          <span className="topbar-day">第{currentDayIndex + 1}天</span>
          <Tag color="blue">{config.stockCode.split('.')[0]}</Tag>
        </div>
        <div className="topbar-center">
          <span className="topbar-stat">💰 ¥{cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          {position && <span className="topbar-stat">📦 {position.shares}股@{position.avg_cost.toFixed(2)}</span>}
          <span className={`topbar-stat ${profitPct >= 0 ? 'profit-up' : 'profit-down'}`}>
            {profitPct >= 0 ? '📈' : '📉'} {profitPct >= 0 ? '+' : ''}{profitPct.toFixed(2)}%
          </span>
        </div>
        <div className="topbar-right">
          <Radio.Group size="small" value={positionRatio} onChange={e => setPositionRatio(e.target.value)}>
            <Radio.Button value={1.0}>全仓</Radio.Button>
            <Radio.Button value={0.5}>半仓</Radio.Button>
          </Radio.Group>
          <Button size="small" danger onClick={endTraining}>结束</Button>
        </div>
      </div>

      {/* 快捷键提示 + 操作反馈 */}
      <div className="action-bar">
        <div className="hotkey-bar">
          <span className="hotkey-item"><kbd>Q</kbd> 买入</span>
          <span className="hotkey-item"><kbd>W</kbd> 卖出</span>
          <span className="hotkey-item"><kbd>E</kbd> 观望/下一天</span>
        </div>
        {actionMsg && (
          <div className={`action-feedback ${actionMsg.type}`}>
            {actionMsg.type === 'buy' && '🔴 '}{actionMsg.type === 'sell' && '🟢 '}
            {actionMsg.type === 'hold' && '⏸️ '}{actionMsg.type === 'warning' && '⚠️ '}
            {actionMsg.text}
          </div>
        )}
      </div>

      {/* 主体布局：左列表 右K线 */}
      <div className="trading-main">
        <div className="trading-left">
          <Table
            dataSource={marketData}
            columns={columns}
            rowKey="stock_code"
            size="small"
            loading={loading}
            pagination={{ pageSize: 25, showSizeChanger: false, size: 'small' }}
            scroll={{ y: 'calc(100vh - 260px)' }}
            rowClassName={(record) => record.stock_code === config.stockCode ? 'ant-table-row-selected' : ''}
            onRow={(record) => ({ onClick: () => setSelectedStock(record.stock_code) })}
          />
        </div>

        <div className="trading-right">
          <Card size="small"
            title={`${displayStock.split('.')[0]} K线`}
            extra={selectedStock && selectedStock !== config.stockCode && (
              <Button size="small" type="link" onClick={() => setSelectedStock(null)}>回到目标</Button>
            )}
            bodyStyle={{ padding: '8px 0 0 0' }}
          >
            <KLineChart stockCode={displayStock} endDate={currentDate} days={0} height={Math.max(400, window.innerHeight - 300)} />
          </Card>

          {tradeHistory.length > 0 && (
            <div className="trade-log">
              {tradeHistory.slice(-5).reverse().map((t, i) => (
                <span key={i} className="trade-log-item">
                  <Tag color={t.action === 'buy' ? 'red' : 'green'} style={{ fontSize: 11, marginRight: 4 }}>
                    {t.action === 'buy' ? '买' : '卖'}
                  </Tag>
                  {t.date.slice(5)} {t.shares}@{t.price.toFixed(2)}
                  {t.profit !== undefined && <span style={{ color: t.profit >= 0 ? '#cf1322' : '#3f8600' }}> {t.profit >= 0 ? '+' : ''}{t.profit.toFixed(0)}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TradingPage
