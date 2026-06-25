import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Spin, Empty } from 'antd'
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts'
import { dataAPI } from '../api'

/**
 * 可交互K线图组件（基于TradingView lightweight-charts）
 * 图表实例复用：stockCode变化时重建，日期推进时只更新数据
 */
function KLineChart({ stockCode, endDate, days = 0, height = 400, preloadedData = null, markers = [] }) {
  const [apiData, setApiData] = useState(null)
  const [loading, setLoading] = useState(false)
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const markersRef = useRef(null)
  const prevStockRef = useRef(null)
  const resizeHandlerRef = useRef(null)

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

  // 转换为图表格式的数据
  const chartData = React.useMemo(() => {
    if (!chartSourceData || chartSourceData.length === 0) return []
    return chartSourceData
      .filter(d => d.open && d.high && d.low && d.close)
      .map(d => ({
        time: typeof d.date === 'string' ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
  }, [chartSourceData])

  // 创建图表实例的辅助函数
  const createChartInstance = useCallback(() => {
    if (!chartContainerRef.current) return

    // 销毁旧实例
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      seriesRef.current = null
      markersRef.current = null
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: { background: { color: '#ffffff' }, textColor: '#333' },
      grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: '#ddd' },
      timeScale: { borderColor: '#ddd', timeVisible: false },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#ef5350',
      downColor: '#26a69a',
      borderUpColor: '#ef5350',
      borderDownColor: '#26a69a',
      wickUpColor: '#ef5350',
      wickDownColor: '#26a69a',
    })

    chartRef.current = chart
    seriesRef.current = series
    prevStockRef.current = stockCode
  }, [stockCode, height])

  // 组件卸载时清理 + resize监听
  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }
    resizeHandlerRef.current = handleResize
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
      }
    }
  }, [])

  // 核心渲染逻辑：创建或更新图表（无cleanup，图表实例由unmount effect管理）
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return

    // stockCode变化 或 图表不存在 → 需要创建/重建图表
    if (!chartRef.current || prevStockRef.current !== stockCode) {
      createChartInstance()
    }

    if (!seriesRef.current) return

    // 更新K线数据（复用已有图表实例，无需重建DOM）
    seriesRef.current.setData(chartData)

    // 更新买卖标记
    if (markersRef.current) {
      markersRef.current.setMarkers([])
      markersRef.current = null
    }
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
        markersRef.current = createSeriesMarkers(seriesRef.current, chartMarkers)
      }
    }

    // 设置可见范围到最近半年
    const lastDate = chartData[chartData.length - 1].time
    const halfYearAgo = new Date(lastDate)
    halfYearAgo.setMonth(halfYearAgo.getMonth() - 6)
    const fromDate = halfYearAgo.toISOString().slice(0, 10)
    chartRef.current.timeScale().setVisibleRange({ from: fromDate, to: lastDate })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, markers, stockCode, height])

  if (loading) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
  if (!chartSourceData || chartSourceData.length === 0) return <Empty description="暂无K线数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />

  return <div ref={chartContainerRef} style={{ width: '100%' }} />
}

export default KLineChart
