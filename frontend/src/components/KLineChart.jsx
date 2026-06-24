import React, { useEffect, useRef, useState } from 'react'
import { Spin, Empty } from 'antd'
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts'
import { dataAPI } from '../api'

/**
 * 可交互K线图组件（基于TradingView lightweight-charts）
 * 支持拖动、缩放
 */
function KLineChart({ stockCode, endDate, days = 0, height = 400, preloadedData = null, markers = [] }) {
  const [apiData, setApiData] = useState(null)
  const [loading, setLoading] = useState(false)
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)

  // 当没有预加载数据时，从API获取
  useEffect(() => {
    if (!stockCode || !endDate) return
    if (preloadedData && preloadedData.length > 0) {
      setApiData(null)
      return
    }
    setLoading(true)
    dataAPI.getStockHistory(stockCode, endDate, days)
      .then(res => setApiData(res.data))
      .catch(() => setApiData([]))
      .finally(() => setLoading(false))
  }, [stockCode, endDate, days, preloadedData])

  // 计算实际使用的数据：优先从预加载数据过滤，否则用API数据
  const chartSourceData = React.useMemo(() => {
    if (preloadedData && preloadedData.length > 0) {
      return preloadedData.filter(d => {
        const dStr = typeof d.date === 'string' ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10)
        return dStr < endDate
      })
    }
    return apiData || []
  }, [preloadedData, endDate, apiData])

  // 渲染图表（数据和标记同步处理）
  useEffect(() => {
    if (!chartContainerRef.current) return

    // 清除旧图表
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    if (!chartSourceData || chartSourceData.length === 0) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: {
        mode: 0, // Normal
      },
      rightPriceScale: {
        borderColor: '#ddd',
      },
      timeScale: {
        borderColor: '#ddd',
        timeVisible: false,
      },
    })

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef5350',
      downColor: '#26a69a',
      borderUpColor: '#ef5350',
      borderDownColor: '#26a69a',
      wickUpColor: '#ef5350',
      wickDownColor: '#26a69a',
    })

    const chartData = chartSourceData
      .filter(d => d.open && d.high && d.low && d.close)
      .map(d => ({
        time: typeof d.date === 'string' ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))

    candlestickSeries.setData(chartData)

    // 添加买卖点标注（只画K线已有日期的标记，当天交易在下一交易日可见）
    if (markers && markers.length > 0) {
      const timeSet = new Set(chartData.map(d => d.time))
      const chartMarkers = markers
        .filter(m => m.date && (m.action === 'buy' || m.action === 'sell') && timeSet.has(m.date))
        .map(m => ({
          time: m.date,
          position: m.action === 'buy' ? 'belowBar' : 'aboveBar',
          color: m.action === 'buy' ? '#ef5350' : '#26a69a',
          shape: m.action === 'buy' ? 'arrowUp' : 'arrowDown',
          text: m.action === 'buy' ? `B ${m.price.toFixed(2)}` : `S ${m.price.toFixed(2)}`,
        }))
        .sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0)
      if (chartMarkers.length > 0) {
        createSeriesMarkers(candlestickSeries, chartMarkers)
      }
    }

    // 默认显示最近半年的数据，用户可拖动查看更早的
    if (chartData.length > 0) {
      const lastDate = chartData[chartData.length - 1].time
      const halfYearAgo = new Date(lastDate)
      halfYearAgo.setMonth(halfYearAgo.getMonth() - 6)
      const fromDate = halfYearAgo.toISOString().slice(0, 10)
      chart.timeScale().setVisibleRange({ from: fromDate, to: lastDate })
    } else {
      chart.timeScale().fitContent()
    }

    chartRef.current = chart

    // 响应式
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [chartSourceData, height, markers])

  if (loading) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
  if (!chartSourceData || chartSourceData.length === 0) return <Empty description="暂无K线数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />

  return <div ref={chartContainerRef} style={{ width: '100%' }} />
}

export default KLineChart
