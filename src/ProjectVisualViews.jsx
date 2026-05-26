import { useMemo, useRef, useState } from 'react'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseDate(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(value) {
  return value || 'Sem prazo'
}

function dateLabel(value) {
  if (!value) return 'Sem prazo'
  const date = parseDate(value)
  if (!date) return value
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
}

function fullDateLabel(value) {
  if (!value) return 'Sem prazo'
  const date = parseDate(value)
  if (!date) return value
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function stackedDateParts(value) {
  const date = parseDate(value)
  if (!date) return null
  return {
    day: date.toLocaleDateString('pt-PT', { day: '2-digit' }),
    month: date.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', ''),
    year: date.toLocaleDateString('pt-PT', { year: 'numeric' }),
  }
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function diffDays(a, b) {
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY)
}

function workItemTypeShort(type) {
  if (type === 'task') return 'T'
  if (type === 'subtask') return 'SubT'
  if (type === 'milestone') return 'M'
  return 'P'
}

function statusLabel(status) {
  const labels = {
    not_started: 'Não iniciado',
    in_progress: 'Em curso',
    blocked: 'Bloqueado',
    done: 'Concluído',
    cancelled: 'Cancelado',
  }
  return labels[status] ?? status ?? 'Sem estado'
}

function statusColor(status) {
  const colors = {
    done: { fill: '#dcefd8', border: '#8eb583' },
    in_progress: { fill: '#dce7f7', border: '#6c89bb' },
    blocked: { fill: '#f3dfcf', border: '#b7835f' },
    cancelled: { fill: '#ececec', border: '#b5b5b5' },
    not_started: { fill: '#ffffff', border: '#cfd9ca' },
  }
  return colors[status] ?? colors.not_started
}

function itemFullLabel(item) {
  return `${item.outlineNumber}. ${workItemTypeShort(item.type)}: ${item.name}`
}

function itemFullDetails(item, workItemPeople = [], peopleMap = new Map()) {
  const responsible = primaryPersonName(item.id, workItemPeople, peopleMap)
  const lines = [
    itemFullLabel(item),
    responsible ? `Responsável: ${responsible}` : 'Adicionar responsável depois',
    item.due_date ? `Prazo: ${fullDateLabel(item.due_date)}` : 'Adicionar prazo depois',
    `Estado: ${statusLabel(item.status)}`,
  ]
  if (item.description) lines.push(`Notas: ${item.description}`)
  return lines.join('\n')
}

function dependencyColor(type) {
  if (type === 'related_to') return '#7c8b80'
  if (type === 'start_to_start') return '#577aaa'
  if (type === 'finish_to_finish') return '#8066a5'
  if (type === 'blocks') return '#9a6f16'
  return '#2f6f44'
}

function buildProjectRows({ project, workItems }) {
  const byParent = new Map()
  for (const item of workItems) {
    const key = item.parent_work_item_id || ''
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(item)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt'))
  }

  const rows = []
  const seen = new Set()

  function walk(parentId, depth = 0, prefix = '') {
    const children = byParent.get(parentId) ?? []
    children.forEach((child, index) => {
      if (seen.has(child.id)) return
      seen.add(child.id)
      const outlineNumber = prefix ? `${prefix}.${index + 1}` : `${index + 1}`
      rows.push({ ...child, depth, outlineNumber })
      walk(child.id, depth + 1, outlineNumber)
    })
  }

  walk(project?.id)
  return rows
}

function primaryPersonName(itemId, workItemPeople = [], peopleMap = new Map()) {
  const rows = workItemPeople.filter((row) => row.work_item_id === itemId)
  if (!rows.length) return ''
  rows.sort((a, b) => (a.is_primary === b.is_primary ? String(a.person?.name ?? '').localeCompare(String(b.person?.name ?? ''), 'pt') : a.is_primary ? -1 : 1))
  return rows[0]?.person?.name ?? rows[0]?.person_name ?? peopleMap.get(rows[0]?.person_id)?.name ?? ''
}

function visualShellStyle(compact) {
  return {
    border: '1px solid #dfe7da',
    borderRadius: 10,
    background: '#fff',
    padding: compact ? 10 : 12,
    minWidth: 0,
    overflow: 'hidden',
  }
}

function visualTitleStyle() {
  return {
    fontSize: 13,
    lineHeight: 1.2,
    color: '#16361f',
    fontWeight: 800,
  }
}

function smallButtonStyle(active = false) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 10px',
    borderRadius: 8,
    border: active ? '1px solid #b7cda8' : '1px solid #cfd9ca',
    background: active ? '#e8f2e0' : '#fff',
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1.15,
    color: '#16361f',
  }
}

function ProjectVisualHeader({ project, mode, onModeChange, onClose, showModeButtons = true }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', minWidth: 0, flexWrap: 'wrap' }}>
        <strong style={visualTitleStyle()}>{mode === 'gantt' ? 'Gantt' : 'Esquema'}</strong>
        <span style={{ fontSize: 13, color: '#5f6f66' }}>-</span>
        <span style={{ ...visualTitleStyle(), minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project?.name ?? 'Projeto'}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        {showModeButtons ? (
          <>
            <button type="button" style={smallButtonStyle(mode === 'board')} onClick={() => onModeChange?.('board')}>Esquema</button>
            <button type="button" style={smallButtonStyle(mode === 'gantt')} onClick={() => onModeChange?.('gantt')}>Gantt</button>
          </>
        ) : null}
        {onClose ? <button type="button" style={smallButtonStyle()} onClick={onClose}>Fechar</button> : null}
      </div>
    </div>
  )
}

function BoardDateLabel({ value, compact }) {
  if (!value || value === 'Sem prazo') {
    return <span>{value}</span>
  }
  const parts = stackedDateParts(value)
  if (!parts) return <span>{value}</span>
  if (!compact) return <span>{fullDateLabel(value)}</span>
  return (
    <span style={{ display: 'grid', gap: 0, lineHeight: 0.96 }}>
      <span style={{ fontSize: 13 }}>{parts.day}</span>
      <span style={{ fontSize: 9.5, color: '#6a7a70', fontWeight: 800, textTransform: 'uppercase' }}>{parts.month}</span>
    </span>
  )
}

function GanttDateLabel({ date, compact }) {
  const value = date.toISOString().slice(0, 10)
  const parts = stackedDateParts(value)
  if (!parts) return null
  return (
    <span style={{ display: 'grid', gap: 0, lineHeight: 0.95 }}>
      <span style={{ fontSize: compact ? 11 : 12, fontWeight: 800 }}>{parts.day}</span>
      <span style={{ fontSize: compact ? 8.5 : 9.5, fontWeight: 700, textTransform: 'uppercase' }}>{parts.month}</span>
    </span>
  )
}

function ProjectBoard({ project, rows, dependencies, workItemPeople, peopleMap, compact, onItemClick }) {
  const [zoom, setZoom] = useState(1)
  const scrollerRef = useRef(null)
  const dragRef = useRef(null)

  if (!rows.length) {
    return <div style={{ fontSize: 12, color: '#5f6f66' }}>Sem tarefas neste projeto.</div>
  }

  const itemIds = new Set(rows.map((row) => row.id))
  const projectDeps = dependencies.filter((dep) => itemIds.has(dep.predecessor_work_item_id) && itemIds.has(dep.successor_work_item_id))
  const datedKeys = Array.from(new Set(rows.map((row) => dateKey(row.due_date))))
  datedKeys.sort((a, b) => {
    if (a === 'Sem prazo') return 1
    if (b === 'Sem prazo') return -1
    return String(a).localeCompare(String(b))
  })

  const columnWidth = (compact ? 144 : 250) * zoom
  const rowHeight = (compact ? 58 : 74) * zoom
  const topOffset = (compact ? 44 : 48) * zoom
  const leftInset = 10
  const dependencyLaneWidth = projectDeps.length ? (compact ? 78 : Math.min(220, Math.max(96, 70 + projectDeps.length * 14))) : 28
  const columnsWidth = Math.max(1, datedKeys.length) * columnWidth + leftInset * 2
  const boardWidth = columnsWidth + dependencyLaneWidth
  const boardHeight = topOffset + rows.length * rowHeight + 12
  const positions = new Map()

  rows.forEach((row, rowIndex) => {
    const columnIndex = datedKeys.indexOf(dateKey(row.due_date))
    positions.set(row.id, {
      x: leftInset + columnIndex * columnWidth + 12,
      y: topOffset + rowIndex * rowHeight + 8,
      width: columnWidth - 28,
      height: (compact ? 42 : 56) * zoom,
    })
  })

  function startDrag(event) {
    if (!scrollerRef.current || event.button !== 0) return
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: scrollerRef.current.scrollLeft,
      top: scrollerRef.current.scrollTop,
    }
    scrollerRef.current.style.cursor = 'grabbing'
  }

  function moveDrag(event) {
    if (!dragRef.current || !scrollerRef.current) return
    scrollerRef.current.scrollLeft = dragRef.current.left - (event.clientX - dragRef.current.x)
    scrollerRef.current.scrollTop = dragRef.current.top - (event.clientY - dragRef.current.y)
  }

  function endDrag() {
    dragRef.current = null
    if (scrollerRef.current) scrollerRef.current.style.cursor = 'grab'
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#5f6f66' }}>Arrasta o quadro para navegar</div>
        <div style={{ display: 'flex', gap: 5 }}>
          <button type="button" style={smallButtonStyle()} onClick={() => setZoom((value) => Math.max(0.72, Number((value - 0.12).toFixed(2))))}>−</button>
          <button type="button" style={smallButtonStyle()} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" style={smallButtonStyle()} onClick={() => setZoom((value) => Math.min(1.45, Number((value + 0.12).toFixed(2))))}>+</button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        onMouseDown={startDrag}
        onMouseMove={moveDrag}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{
          overflow: 'auto',
          border: '1px solid #e3eadf',
          borderRadius: 10,
          background: '#fbfcfa',
          cursor: 'grab',
          maxHeight: compact ? 'calc(100vh - 330px)' : '70vh',
        }}
      >
      <div style={{ position: 'relative', width: boardWidth, minWidth: '100%', minHeight: boardHeight }}>
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 3, background: '#fbfcfa', borderBottom: '1px solid #e3eadf' }}>
          {datedKeys.map((key, index) => (
            <div key={key} style={{ width: columnWidth, padding: compact ? '6px 10px' : '9px 12px', fontSize: 12, fontWeight: 800, color: '#2f4b35', borderLeft: index > 0 ? '1px solid #dce7d7' : 'none' }}>
              <BoardDateLabel value={key} compact={compact} />
            </div>
          ))}
        </div>

        {datedKeys.map((key, index) => (
          <div
            key={`column-line-${key}`}
            style={{
              position: 'absolute',
              left: leftInset + index * columnWidth,
              top: 0,
              width: columnWidth,
              height: boardHeight,
              borderLeft: index > 0 ? '1px solid #e0e9dc' : 'none',
              borderRight: '1px solid #edf2ea',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        ))}

        {projectDeps.length ? (
          <div
            style={{
              position: 'absolute',
              left: columnsWidth,
              top: 34,
              width: dependencyLaneWidth,
              height: boardHeight - 34,
              zIndex: 1,
              borderLeft: '1px dashed #c2d3bd',
              background: 'linear-gradient(90deg, rgba(220,239,216,0.35), rgba(255,255,255,0))',
              pointerEvents: 'none',
            }}
          />
        ) : null}

        <svg width={boardWidth} height={boardHeight} style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
          <defs>
            <marker id={`arrow-${project.id}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M 0 0 L 7 3.5 L 0 7 z" fill="#557760" />
            </marker>
          </defs>
          {projectDeps.map((dep, depIndex) => {
            const from = positions.get(dep.predecessor_work_item_id)
            const to = positions.get(dep.successor_work_item_id)
            if (!from || !to) return null
            const startX = from.x + from.width
            const startY = from.y + from.height / 2
            const endX = to.x + to.width
            const endY = to.y + to.height / 2
            const laneSlots = compact ? 1 : Math.max(1, Math.floor((dependencyLaneWidth - 52) / 14))
            const laneCenter = columnsWidth + (compact ? 28 : 28 + (depIndex % laneSlots) * 14)
            const laneX = Math.min(boardWidth - 24, laneCenter)
            const color = dependencyColor(dep.dependency_type)
            return (
              <path
                key={dep.id}
                d={`M ${startX} ${startY} H ${laneX} V ${endY} H ${endX + 8}`}
                fill="none"
                stroke={color}
                strokeWidth={compact ? '2' : '2.5'}
                markerEnd={`url(#arrow-${project.id})`}
                opacity="0.82"
              />
            )
          })}
        </svg>

        {rows.map((row) => {
          const position = positions.get(row.id)
          const colors = statusColor(row.status)
          const responsible = primaryPersonName(row.id, workItemPeople, peopleMap)
          return (
            <div
              key={row.id}
              title={itemFullDetails(row, workItemPeople, peopleMap)}
              style={{
                position: 'absolute',
                left: position.x,
                top: position.y,
                width: position.width,
                minHeight: position.height,
                zIndex: 2,
                border: `1px solid ${colors.border}`,
                borderRadius: 7,
                background: colors.fill,
                padding: compact ? '5px 7px' : '8px 9px',
                boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
                cursor: onItemClick ? 'pointer' : 'default',
              }}
              onClick={() => onItemClick?.(row)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: compact ? 10 : 11, fontWeight: 800, color: '#35513c', flexShrink: 0 }}>{row.outlineNumber}. {workItemTypeShort(row.type)}</span>
                <strong style={{ fontSize: compact ? 10.5 : 13, lineHeight: 1.12, color: '#16361f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</strong>
              </div>
              <div style={{ marginTop: 3, fontSize: compact ? 9.5 : 11, color: '#5f6f66', lineHeight: 1.16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {responsible ? `Responsável: ${responsible}` : 'Adicionar responsável depois'} · {row.due_date ? `Prazo: ${row.due_date}` : 'Adicionar prazo depois'}
              </div>
              <div style={{ marginTop: 3, fontSize: compact ? 9 : 10.5, color: '#46604d' }}>{statusLabel(row.status)}</div>
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}

function ProjectGantt({ rows, dependencies, compact, onItemClick, workItemPeople, peopleMap }) {
  if (!rows.length) {
    return <div style={{ fontSize: 12, color: '#5f6f66' }}>Sem tarefas neste projeto.</div>
  }

  const dueDates = rows.map((row) => parseDate(row.due_date)).filter(Boolean)
  if (!dueDates.length) {
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        {rows.map((row) => (
          <div key={row.id} title={itemFullDetails(row)} style={{ border: '1px solid #e3eadf', borderRadius: 8, padding: '8px 10px', background: '#fbfcfa', fontSize: 12, cursor: onItemClick ? 'pointer' : 'default' }} onClick={() => onItemClick?.(row)}>
            <strong>{row.outlineNumber}. {workItemTypeShort(row.type)}: {row.name}</strong>
            <div style={{ color: '#5f6f66', marginTop: 2 }}>Sem prazo definido</div>
          </div>
        ))}
      </div>
    )
  }

  const dependencyBySuccessor = new Map()
  for (const dep of dependencies) {
    if (!dependencyBySuccessor.has(dep.successor_work_item_id)) dependencyBySuccessor.set(dep.successor_work_item_id, [])
    dependencyBySuccessor.get(dep.successor_work_item_id).push(dep)
  }
  const dueDateById = new Map(rows.map((row) => [row.id, parseDate(row.due_date)]))
  const starts = new Map()

  for (const row of rows) {
    const due = parseDate(row.due_date)
    if (!due) continue
    const defaultDuration = row.type === 'subtask' ? 2 : row.type === 'milestone' ? 1 : 5
    let start = addDays(due, -(defaultDuration - 1))
    for (const dep of dependencyBySuccessor.get(row.id) ?? []) {
      const predecessorDue = dueDateById.get(dep.predecessor_work_item_id)
      if (!predecessorDue) continue
      const candidate = addDays(predecessorDue, (dep.lag_days ?? 0) + (dep.dependency_type === 'finish_to_start' ? 1 : 0))
      if (candidate > start && candidate <= due) start = candidate
    }
    starts.set(row.id, start)
  }

  const minStart = new Date(Math.min(...Array.from(starts.values()).map((date) => date.getTime()), ...dueDates.map((date) => date.getTime())))
  const maxDue = new Date(Math.max(...dueDates.map((date) => date.getTime())))
  const startRange = addDays(minStart, -1)
  const totalDays = Math.max(1, diffDays(maxDue, startRange) + 2)
  const dayWidth = compact ? 30 : 36
  const labelWidth = compact ? 190 : 230
  const rowHeight = compact ? 42 : 48
  const timelineWidth = totalDays * dayWidth
  const visibleDependencies = dependencies.filter((dep) => rows.some((row) => row.id === dep.predecessor_work_item_id) && rows.some((row) => row.id === dep.successor_work_item_id))
  const dependencyLaneWidth = visibleDependencies.length ? Math.max(96, Math.min(180, 88 + visibleDependencies.length * 8)) : 24
  const timelineRight = labelWidth + timelineWidth
  const chartWidth = timelineRight + dependencyLaneWidth + 18
  const barPositions = new Map()
  rows.forEach((row, index) => {
    const due = parseDate(row.due_date)
    const start = starts.get(row.id)
    const rowCenterY = 35 + index * rowHeight + 10 + (compact ? 9 : 11)
    if (!due || !start) {
      barPositions.set(row.id, {
        x: timelineRight + 10,
        y: rowCenterY,
        endX: timelineRight + 18,
        hasDate: false,
      })
      return
    }
    const left = labelWidth + diffDays(start, startRange) * dayWidth
    const width = Math.max(dayWidth * 0.75, (diffDays(due, start) + 1) * dayWidth)
    barPositions.set(row.id, {
      x: left,
      y: rowCenterY,
      endX: left + width,
      hasDate: true,
    })
  })
  const markerId = `gantt-arrow-${rows[0]?.id ?? 'empty'}`

  return (
    <div style={{ overflow: 'auto', border: '1px solid #e3eadf', borderRadius: 10, background: '#fbfcfa' }}>
      <div style={{ width: chartWidth, minWidth: '100%', position: 'relative' }}>
        <svg width={chartWidth} height={35 + rows.length * rowHeight} style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
          <defs>
            <marker id={markerId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M 0 0 L 7 3.5 L 0 7 z" fill="#557760" />
            </marker>
          </defs>
          {visibleDependencies.map((dep, index) => {
            const from = barPositions.get(dep.predecessor_work_item_id)
            const to = barPositions.get(dep.successor_work_item_id)
            if (!from || !to) return null
            const laneX = timelineRight + 22 + (index % Math.max(1, Math.floor((dependencyLaneWidth - 44) / 12))) * 12
            const targetX = to.hasDate ? to.endX + 5 : timelineRight + 8
            return (
              <path
                key={dep.id}
                d={`M ${from.endX + 4} ${from.y} H ${laneX} V ${to.y} H ${targetX}`}
                fill="none"
                stroke={dependencyColor(dep.dependency_type)}
                strokeWidth="1.55"
                markerEnd={`url(#${markerId})`}
                opacity="0.72"
              />
            )
          })}
        </svg>
        <div style={{ display: 'grid', gridTemplateColumns: `${labelWidth}px ${timelineWidth + dependencyLaneWidth + 18}px`, position: 'sticky', top: 0, background: '#fbfcfa', zIndex: 2, borderBottom: '1px solid #e3eadf' }}>
          <div style={{ padding: '9px 10px', fontSize: 12, fontWeight: 800, color: '#2f4b35' }}>Item</div>
          <div style={{ position: 'relative', height: 34 }}>
            {Array.from({ length: totalDays }).map((_, index) => {
              const date = addDays(startRange, index)
              return (
                <div key={index} style={{ position: 'absolute', left: index * dayWidth, top: 0, width: dayWidth, height: 34, borderLeft: '1px solid #e3eadf', paddingTop: 4, textAlign: 'center', color: '#5f6f66' }}>
                  <GanttDateLabel date={date} compact={compact} />
                </div>
              )
            })}
            {visibleDependencies.length ? (
              <div style={{ position: 'absolute', left: timelineWidth, top: 0, width: dependencyLaneWidth, height: '100%', borderLeft: '1px dashed #c2d3bd', background: 'linear-gradient(90deg, rgba(220,239,216,0.3), rgba(255,255,255,0))' }} />
            ) : null}
          </div>
        </div>

        {rows.map((row) => {
          const due = parseDate(row.due_date)
          const start = starts.get(row.id)
          const colors = statusColor(row.status)
          const left = start ? diffDays(start, startRange) * dayWidth : 0
          const width = start && due ? Math.max(dayWidth * 0.75, (diffDays(due, start) + 1) * dayWidth) : dayWidth
          return (
            <div key={row.id} title={itemFullDetails(row, workItemPeople, peopleMap)} style={{ display: 'grid', gridTemplateColumns: `${labelWidth}px ${timelineWidth + dependencyLaneWidth + 18}px`, minHeight: rowHeight, borderBottom: '1px solid #e9efe6', cursor: onItemClick ? 'pointer' : 'default' }} onClick={() => onItemClick?.(row)}>
              <div style={{ padding: '8px 10px', fontSize: 12, lineHeight: 1.2, color: '#16361f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ paddingLeft: row.depth * 12 }}>
                  {row.outlineNumber}. {workItemTypeShort(row.type)}: {row.name}
                </span>
              </div>
              <div style={{ position: 'relative', minHeight: rowHeight }}>
                {Array.from({ length: totalDays }).map((_, index) => (
                  <div key={index} style={{ position: 'absolute', left: index * dayWidth, top: 0, width: 1, height: '100%', background: '#e3eadf' }} />
                ))}
                {due ? (
                  <div
                    title={`${row.name}: ${fullDateLabel(row.due_date)}`}
                    style={{
                      position: 'absolute',
                      left,
                      top: 10,
                      width,
                      height: compact ? 18 : 22,
                      borderRadius: 6,
                      border: `1px solid ${colors.border}`,
                      background: colors.fill,
                      color: '#16361f',
                      fontSize: 10.5,
                      lineHeight: compact ? '16px' : '20px',
                      padding: '0 6px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {statusLabel(row.status)}
                  </div>
                ) : (
                  <span style={{ position: 'absolute', top: 10, left: 8, fontSize: 11, color: '#7c8b80' }}>Sem prazo</span>
                )}
                {visibleDependencies.length ? (
                  <div style={{ position: 'absolute', left: timelineWidth, top: 0, width: dependencyLaneWidth, height: '100%', borderLeft: '1px dashed #c2d3bd', background: 'linear-gradient(90deg, rgba(220,239,216,0.18), rgba(255,255,255,0))', pointerEvents: 'none' }} />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ProjectVisualView({
  project,
  workItems,
  dependencies,
  workItemPeople,
  people = [],
  mode = 'board',
  onModeChange,
  onClose,
  onItemClick,
  showModeButtons = true,
  compact = false,
}) {
  const [previewItem, setPreviewItem] = useState(null)
  const rows = useMemo(() => buildProjectRows({ project, workItems }), [project, workItems])
  const itemIds = useMemo(() => new Set(rows.map((row) => row.id)), [rows])
  const projectDependencies = useMemo(
    () => dependencies.filter((dep) => itemIds.has(dep.predecessor_work_item_id) && itemIds.has(dep.successor_work_item_id)),
    [dependencies, itemIds],
  )
  const peopleMap = useMemo(() => new Map(people.map((person) => [person.id, person])), [people])
  const previewResponsible = previewItem ? primaryPersonName(previewItem.id, workItemPeople, peopleMap) : ''

  return (
    <div style={{ ...visualShellStyle(compact), position: 'relative', overflow: 'visible' }}>
      <ProjectVisualHeader project={project} mode={mode} onModeChange={onModeChange} onClose={onClose} showModeButtons={showModeButtons} />
      {mode === 'gantt' ? (
        <ProjectGantt rows={rows} dependencies={projectDependencies} compact={compact} onItemClick={setPreviewItem} workItemPeople={workItemPeople} peopleMap={peopleMap} />
      ) : (
        <ProjectBoard project={project} rows={rows} dependencies={projectDependencies} workItemPeople={workItemPeople} peopleMap={peopleMap} compact={compact} onItemClick={setPreviewItem} />
      )}
      {previewItem ? (
        <div
          role="dialog"
          aria-modal="false"
          style={{
            position: 'absolute',
            right: 12,
            top: 46,
            zIndex: 12,
            width: 'min(360px, calc(100% - 24px))',
            border: '1px solid #cfd9ca',
            borderRadius: 10,
            background: '#fff',
            boxShadow: '0 14px 36px rgba(22,54,31,0.18)',
            padding: 12,
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <strong style={{ fontSize: 13, lineHeight: 1.2, color: '#16361f' }}>{itemFullLabel(previewItem)}</strong>
            <button type="button" style={{ ...smallButtonStyle(), padding: '3px 7px' }} onClick={() => setPreviewItem(null)}>Fechar</button>
          </div>
          <div style={{ fontSize: 11.5, color: '#5f6f66', lineHeight: 1.35 }}>
            {previewResponsible ? `Responsável: ${previewResponsible}` : 'Adicionar responsável depois'} · {previewItem.due_date ? `Prazo: ${fullDateLabel(previewItem.due_date)}` : 'Adicionar prazo depois'}
          </div>
          <div style={{ fontSize: 11.5, color: '#46604d' }}>Estado: {statusLabel(previewItem.status)}</div>
          {previewItem.description ? (
            <div style={{ fontSize: 11.5, lineHeight: 1.35, color: '#16361f', whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto', border: '1px solid #e3eadf', borderRadius: 8, padding: 8 }}>
              {previewItem.description}
            </div>
          ) : null}
          {onItemClick ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                style={smallButtonStyle(true)}
                onClick={() => {
                  const item = previewItem
                  setPreviewItem(null)
                  onItemClick(item)
                }}
              >
                Abrir
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
