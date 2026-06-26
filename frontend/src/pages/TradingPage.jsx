import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Button, Tag, Radio, message, Spin, Typography, Popconfirm } from 'antd'
import { dataAPI, sessionAPI } from '../api'
import KLineChart from '../components/KLineChart'

const { Title } = Typography
const emptyMarkers = []

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
  const [preloadedStockData, setPreloadedStockData] = useState(null)
  const [currentPrice, setCurrentPrice] = useState(null)
  const tradingRef = useRef(false)
  const preloadEndRef = useRef(null)

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
    // 预加载目标股票未来一年的数据
    const preloadEnd = new Date(cfg.startDate)
    preloadEnd.setFullYear(preloadEnd.getFullYear() + 1)
    const preloadEndStr = preloadEnd.toISOString().slice(0, 10)
    dataAPI.getStockHistory(cfg.stockCode, preloadEndStr, 0)
      .then(res => setPreloadedStockData(res.data))
      .catch(() => setPreloadedStockData(null))
    preloadEndRef.current = preloadEndStr
  }, [])

  useEffect(() => {
    if (config && config.tradingDays[currentDayIndex]) {
      loadMarketData()
      updateCurrentPrice()
    }
  }, [config, currentDayIndex, preloadedStockData])

  const updateCurrentPrice = () => {
    if (!config) return
    const curDate = config.tradingDays[currentDayIndex]
    // 模拟开盘前：显示前一日收盘价作为当前价格
    if (preloadedStockData && preloadedStockData.length > 0) {
      const latestLoadedDate = preloadedStockData
        .map(d => (typeof d.date === 'string' ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10)))
        .sort()
        .pop()

      // 超出预加载范围，追加加载下一年数据（合并新旧数据保留完整历史）
      if (latestLoadedDate && curDate > latestLoadedDate && preloadEndRef.current) {
        const nextEnd = new Date(preloadEndRef.current)
        nextEnd.setFullYear(nextEnd.getFullYear() + 1)
        const nextEndStr = nextEnd.toISOString().slice(0, 10)
        preloadEndRef.current = nextEndStr // 防止重复请求
        dataAPI.getStockHistory(config.stockCode, nextEndStr, 0)
          .then(res => {
            setPreloadedStockData(prev => {
              if (!prev || prev.length === 0) return res.data
              // 合并：以日期去重，保留完整历史
              const dateKey = d => typeof d.date === 'string' ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10)
              const existingDates = new Set(res.data.map(dateKey))
              const oldUnique = prev.filter(d => !existingDates.has(dateKey(d)))
              return [...oldUnique, ...res.data].sort((a, b) => dateKey(a).localeCompare(dateKey(b)))
            })
          })
          .catch(() => {})
      }

      const prevDayData = preloadedStockData
        .filter(d => {
          const dStr = typeof d.date === 'string' ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10)
          return dStr < curDate
        })
        .pop()
      // 仅在当前日期仍落在已加载范围内时，才使用预加载数据作为当前价
      if (prevDayData && (!latestLoadedDate || curDate <= latestLoadedDate)) {
        setCurrentPrice(prevDayData.close)
        return
      }
    }
    // 回退：从API获取
    dataAPI.getStockPrice(config.stockCode, curDate)
      .then(res => setCurrentPrice(res.data.close))
      .catch(() => {})
  }

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
    if (!config.loadMarket) {
      setLoading(false)
      return
    }
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
      finalCapital += position.shares * (currentPrice || position.avg_cost)
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

    let benchmarkReturn = 0
    if (preloadedStockData && preloadedStockData.length > 0) {
      const normalized = preloadedStockData
        .map(d => ({
          date: typeof d.date === 'string' ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10),
          close: d.close,
        }))
        .filter(d => d.close)

      const startBar = normalized.find(d => d.date >= startDate)
      const endBars = normalized.filter(d => d.date <= endDate)
      const endBar = endBars.length > 0 ? endBars[endBars.length - 1] : null

      if (startBar && endBar && startBar.close > 0) {
        benchmarkReturn = ((endBar.close - startBar.close) / startBar.close) * 100
      }
    }

    const excessReturn = totalReturn - benchmarkReturn

    return {
      startDate,
      endDate,
      initialCapital: initial,
      finalCapital,
      totalReturn,
      annualizedReturn,
      benchmarkReturn,
      excessReturn,
      maxDrawdown,
      totalTrades: tradeHistory.length,
      winRate,
    }
  }

  const handleSaveSummary = async () => {
    const summary = calculateSummary()
    if (!summary) return
    if (!user) { message.info('未登录，训练结果不会保存'); navigate('/'); return }
    try {
      await sessionAPI.save({
        stock_code: config.stockCode,
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
            <div className="stat-item"><div className="label">基准收益率(买入持有)</div><div className={`value ${summary.benchmarkReturn >= 0 ? 'positive' : 'negative'}`}>{summary.benchmarkReturn >= 0 ? '+' : ''}{summary.benchmarkReturn.toFixed(2)}%</div></div>
            <div className="stat-item"><div className="label">超额收益</div><div className={`value ${summary.excessReturn >= 0 ? 'positive' : 'negative'}`}>{summary.excessReturn >= 0 ? '+' : ''}{summary.excessReturn.toFixed(2)}%</div></div>
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
  const positionPrice = currentPrice || position?.avg_cost || 0
  const positionMarketValue = position ? position.shares * positionPrice : 0
  const totalAsset = cash + positionMarketValue
  const profitPct = ((totalAsset - config.initialCapital) / config.initialCapital * 100)
  const positionPnlPct = position ? ((positionPrice - position.avg_cost) / position.avg_cost * 100) : 0

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
          {actionMsg && (
            <div className={`action-feedback ${actionMsg.type}`}>
              {actionMsg.type === 'buy' && '🔴 '}{actionMsg.type === 'sell' && '🟢 '}
              {actionMsg.type === 'hold' && '⏸️ '}{actionMsg.type === 'warning' && '⚠️ '}
              {actionMsg.text}
            </div>
          )}
        </div>
        <div className="topbar-right">
          <Radio.Group size="small" value={positionRatio} onChange={e => setPositionRatio(e.target.value)}>
            <Radio.Button value={1.0}>全仓</Radio.Button>
            <Radio.Button value={0.5}>半仓</Radio.Button>
          </Radio.Group>
          <Popconfirm title="确认结束训练？" description="结束后将显示训练结果总结" onConfirm={endTraining} okText="确认" cancelText="取消">
            <Button size="small" danger>结束</Button>
          </Popconfirm>
        </div>
      </div>

      {/* 主体布局：左K线 右信息面板 */}
      <div className="trading-main" style={{ gridTemplateColumns: config.loadMarket ? '280px 1fr 280px' : '1fr 280px' }}>
        {config.loadMarket && (
        <div className="trading-left">
          <Table
            dataSource={marketData}
            columns={columns}
            rowKey="stock_code"
            size="small"
            loading={loading}
            pagination={{ pageSize: 25, showSizeChanger: false, size: 'small' }}
            scroll={{ y: 'calc(100vh - 160px)' }}
            rowClassName={(record) => record.stock_code === config.stockCode ? 'ant-table-row-selected' : ''}
            onRow={(record) => ({ onClick: () => setSelectedStock(record.stock_code) })}
          />
        </div>
        )}

        <div className="trading-chart">
          <Card size="small"
            title={`${displayStock.split('.')[0]} K线`}
            extra={selectedStock && selectedStock !== config.stockCode && (
              <Button size="small" type="link" onClick={() => setSelectedStock(null)}>回到目标</Button>
            )}
            bodyStyle={{ padding: '8px 0 0 0' }}
          >
            <KLineChart
              stockCode={displayStock}
              endDate={currentDate}
              days={0}
              height={Math.max(400, window.innerHeight - 240)}
              preloadedData={displayStock === config.stockCode ? preloadedStockData : null}
              markers={displayStock === config.stockCode ? tradeHistory : emptyMarkers}
            />
          </Card>
        </div>

        {/* 右侧信息面板 */}
        <div className="trading-panel">
          <div className="panel-section">
            <div className="panel-title">账户概览</div>
            <div className="panel-row">
              <span className="panel-label">总资产</span>
              <span className="panel-value">¥{totalAsset.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="panel-row">
              <span className="panel-label">可用现金</span>
              <span className="panel-value">¥{cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="panel-row">
              <span className="panel-label">总收益</span>
              <span className={`panel-value ${profitPct >= 0 ? 'profit-up' : 'profit-down'}`}>
                {profitPct >= 0 ? '+' : ''}{profitPct.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-title">持仓信息</div>
            <div className="panel-row">
              <span className="panel-label">持仓市值</span>
              <span className="panel-value">¥{positionMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="panel-row">
              <span className="panel-label">持仓数量</span>
              <span className="panel-value">{position ? position.shares : 0}股</span>
            </div>
            <div className="panel-row">
              <span className="panel-label">买入均价</span>
              <span className="panel-value">{position ? position.avg_cost.toFixed(2) : '0.00'}</span>
            </div>
            <div className="panel-row">
              <span className="panel-label">现价</span>
              <span className="panel-value">{currentPrice ? currentPrice.toFixed(2) : '-'}</span>
            </div>
            <div className="panel-row">
              <span className="panel-label">持仓涨跌</span>
              <span className={`panel-value ${positionPnlPct >= 0 ? 'profit-up' : 'profit-down'}`}>
                {position ? (positionPnlPct >= 0 ? '+' : '') + positionPnlPct.toFixed(2) + '%' : '0.00%'}
              </span>
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-title">交易操作</div>
            <div className="panel-actions">
              <Button block className="btn-buy" onClick={() => executeAction('buy')}>
                买入 <kbd>Q</kbd>
              </Button>
              <Button block className="btn-sell" onClick={() => executeAction('sell')}>
                卖出 <kbd>W</kbd>
              </Button>
              <Button block className="btn-hold" onClick={() => executeAction('hold')}>
                观望 <kbd>E</kbd>
              </Button>
            </div>
          </div>

          {tradeHistory.length > 0 && (
            <div className="panel-section">
              <div className="panel-title">交易记录</div>
              <div className="panel-trades">
                {tradeHistory.slice(-6).reverse().map((t, i) => (
                  <div key={i} className="panel-trade-item">
                    <Tag color={t.action === 'buy' ? 'red' : 'green'} style={{ fontSize: 11 }}>
                      {t.action === 'buy' ? '买' : '卖'}
                    </Tag>
                    <span>{t.date.slice(5)} {t.shares}@{t.price.toFixed(2)}</span>
                    {t.profit !== undefined && <span style={{ color: t.profit >= 0 ? '#cf1322' : '#3f8600', marginLeft: 4 }}>{t.profit >= 0 ? '+' : ''}{t.profit.toFixed(0)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TradingPage
