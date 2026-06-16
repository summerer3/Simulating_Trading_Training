import React, { useEffect, useRef, useState } from 'react'
import { Spin, Empty } from 'antd'
import { createChart, CandlestickSeries } from 'lightweight-charts'
import { dataAPI } from '../api'

/**
 * 可交互K线图组件（基于TradingView lightweight-charts）
 * 支持拖动、缩放
 */
function KLineChart({ stockCode, endDate, days = 0, height = 400 }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)

  useEffect(() => {
    if (!stockCode || !endDate) return
    setLoading(true)
    dataAPI.getStockHistory(stockCode, endDate, days)
      .then(res => setData(res.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [stockCode, endDate, days])

  useEffect(() => {
    if (!chartContainerRef.current) return

    // 清除旧图表
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    if (!data || data.length === 0) return

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

    const chartData = data
      .filter(d => d.open && d.high && d.low && d.close)
      .map(d => ({
        time: typeof d.date === 'string' ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))

    candlestickSeries.setData(chartData)

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
    seriesRef.current = candlestickSeries

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
  }, [data, height])

  if (loading) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
  if (!data || data.length === 0) return <Empty description="暂无K线数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />

  return <div ref={chartContainerRef} style={{ width: '100%' }} />
}

export default KLineChart
