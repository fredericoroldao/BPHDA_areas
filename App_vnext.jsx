import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

function findProject(item, map) {
  let current = item
  const visited = new Set()
  while (current) {
    if (visited.has(current.id)) return null
    visited.add(current.id)
    if (current.type === 'project') return current
    if (!current.parent_work_item_id) return null
    current = map.get(current.parent_work_item_id)
  }
  return null
}

function isResolved(depType, predecessorStatus) {
  if (depType === 'related_to') return true
  if (depType === 'start_to_start') return predecessorStatus === 'in_progress' || predecessorStatus === 'done'
  return predecessorStatus === 'done'
}

function dependencySentence(predecessorName, successorName, type, outgoing = false) {
  if (!outgoing) {
    if (type === 'finish_to_start') return `[${successorName}] é bloqueada por [${predecessorName}] e só pode começar depois desta terminar`
    if (type === 'start_to_start') return `[${successorName}] depende de [${predecessorName}] e só pode começar quando esta começar`
    if (type === 'finish_to_finish') return `[${successorName}] depende de [${predecessorName}] e só pode terminar depois desta terminar`
    if (type === 'blocks') return `[${successorName}] é bloqueada por [${predecessorName}] enquanto esta não estiver resolvida`
    return `[${successorName}] está relacionada com [${predecessorName}]`
  }
  if (type === 'finish_to_start') return `[${predecessorName}] bloqueia [${successorName}] e esta só pode começar depois da anterior terminar`
  if (type === 'start_to_start') return `[${predecessorName}] bloqueia [${successorName}] e esta só pode começar quando a anterior começar`
  if (type === 'finish_to_finish') return `[${predecessorName}] bloqueia [${successorName}] e esta só pode terminar depois da anterior terminar`
  if (type === 'blocks') return `[${predecessorName}] bloqueia [${successorName}] enquanto a anterior não estiver resolvida`
  return `[${predecessorName}] está relacionada com [${successorName}]`
}

function taskState(task, dependenciesBySuccessor, workItemMap) {
  if (task.status === 'done') return 'concluída'
  if (task.status === 'cancelled') return 'cancelada'
  if (task.status === 'in_progress') return 'em curso'
  if (task.status === 'blocked') return 'bloqueada'
  const deps = dependenciesBySuccessor.get(task.id) ?? []
  const unresolved = deps.some((dep) => !isResolved(dep.dependency_type, workItemMap.get(dep.predecessor_work_item_id)?.status))
  return unresolved ? 'à espera de dependências' : 'pronta a arrancar'
}

function pillStyle(kind) {
  const map = {
    done: { background: '#edf3ed', border: '1px solid #d0dfd0', color: '#35513c' },
    waiting: { background: '#fff6e5', border: '1px solid #f0ddb2', color: '#7a5a12' },
    ready: { background: '#e8f5e2', border: '1px solid #cfe6c2', color: '#245229' },
    in_progress: { background: '#eaf3ff', border: '1px solid #c9daf5', color: '#224d8a' },
  }
  return { padding: '4px 8px', borderRadius: 999, fontSize: 11, lineHeight: 1.1, ...map[kind] }
}

function cardStyle() {
  return {
    flex: '0 0 460px',
    width: 460,
    maxWidth: 460,
    minWidth: 460,
    background: '#fff',
    border: '1px solid #dfe7da',
    borderRadius: 14,
    padding: 14,
    boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
    overflow: 'hidden',
    textAlign: 'left',
  }
}

export default function App() {
  const [areas, setAreas] = useState([])
  const [functions, setFunctions] = useState([])
  const [areaPeople, setAreaPeople] = useState([])
  const [functionPeople, setFunctionPeople] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [workItemPeople, setWorkItemPeople] = useState([])
  const [workItemDependencies, setWorkItemDependencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeView, setActiveView] = useState('areas')
  const [openAreaIds, setOpenAreaIds] = useState([])
  const [openPersonIds, setOpenPersonIds] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    const [areasResult, functionsResult, areaPeopleResult, functionPeopleResult, workItemsResult, workItemPeopleResult, workItemDependenciesResult] = await Promise.all([
      supabase.from('areas').select('id, name, description, notes, sort_order').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('functions').select('id, area_id, parent_function_id, name, description, notes, sort_order').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('area_people').select('id, area_id, assignment_role, is_primary, person:people(id,name)'),
      supabase.from('function_people').select('id, function_id, assignment_role, is_primary, person:people(id,name)'),
      supabase.from('work_items').select('id, parent_work_item_id, type, name, description, status, sort_order').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('work_item_people').select('id, work_item_id, assignment_role, is_primary, person:people(id,name)'),
      supabase.from('work_item_dependencies').select('id, predecessor_work_item_id, successor_work_item_id, dependency_type, lag_days, note'),
    ])
    const all = [areasResult, functionsResult, areaPeopleResult, functionPeopleResult, workItemsResult, workItemPeopleResult, workItemDependenciesResult]
    const firstError = all.find((r) => r.error)
    if (firstError?.error) {
      setError(firstError.error.message)
      setLoading(false)
      return
    }
    setAreas(areasResult.data ?? [])
    setFunctions(functionsResult.data ?? [])
    setAreaPeople(areaPeopleResult.data ?? [])
    setFunctionPeople(functionPeopleResult.data ?? [])
    setWorkItems(workItemsResult.data ?? [])
    setWorkItemPeople(workItemPeopleResult.data ?? [])
    setWorkItemDependencies(workItemDependenciesResult.data ?? [])
    setLoading(false)
  }

  const areaMap = useMemo(() => new Map(areas.map((x) => [x.id, x])), [areas])
  const functionMap = useMemo(() => new Map(functions.map((x) => [x.id, x])), [functions])
  const workItemMap = useMemo(() => new Map(workItems.map((x) => [x.id, x])), [workItems])

  const dependenciesBySuccessor = useMemo(() => {
    const map = new Map()
    for (const dep of workItemDependencies) {
      if (!map.has(dep.successor_work_item_id)) map.set(dep.successor_work_item_id, [])
      map.get(dep.successor_work_item_id).push(dep)
    }
    return map
  }, [workItemDependencies])

  const dependenciesByPredecessor = useMemo(() => {
    const map = new Map()
    for (const dep of workItemDependencies) {
      if (!map.has(dep.predecessor_work_item_id)) map.set(dep.predecessor_work_item_id, [])
      map.get(dep.predecessor_work_item_id).push(dep)
    }
    return map
  }, [workItemDependencies])

  const childrenByParent = useMemo(() => {
    const map = new Map()
    for (const item of workItems) {
      const key = item.parent_work_item_id ?? ''
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
    for (const list of map.values()) list.sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)||a.name.localeCompare(b.name,'pt'))
    return map
  }, [workItems])

  const primaryPersonByWorkItem = useMemo(() => {
    const grouped = new Map()
    for (const row of workItemPeople) {
      if (!grouped.has(row.work_item_id)) grouped.set(row.work_item_id, [])
      grouped.get(row.work_item_id).push(row)
    }
    const result = new Map()
    for (const [id, rows] of grouped.entries()) {
      rows.sort((a,b) => (a.is_primary === b.is_primary ? (a.person?.name ?? '').localeCompare(b.person?.name ?? '', 'pt') : a.is_primary ? -1 : 1))
      result.set(id, rows[0]?.person?.name ?? null)
    }
    return result
  }, [workItemPeople])

  function collectPendingLeaves(itemId) {
    const children = childrenByParent.get(itemId) ?? []
    if (!children.length) {
      const item = workItemMap.get(itemId)
      if (!item) return []
      if (item.status === 'done' || item.status === 'cancelled') return []
      return [item]
    }
    return children.flatMap((child) => collectPendingLeaves(child.id))
  }

  function projectPendingLabel(projectId) {
    const pending = collectPendingLeaves(projectId)
    if (!pending.length) return 'concluído'
    return pending.map((item) => `[${item.name}]${primaryPersonByWorkItem.get(item.id) ? ` (${primaryPersonByWorkItem.get(item.id)})` : ''}`).join(', ')
  }

  const functionsByAreaParent = useMemo(() => {
    const map = new Map()
    for (const fn of functions) {
      const key = `${fn.area_id}::${fn.parent_function_id ?? ''}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(fn)
    }
    return map
  }, [functions])

  const areaPeopleByArea = useMemo(() => {
    const grouped = {}
    for (const row of areaPeople) {
      if (!grouped[row.area_id]) grouped[row.area_id] = []
      grouped[row.area_id].push(row)
    }
    return grouped
  }, [areaPeople])

  const functionPeopleByFunction = useMemo(() => {
    const grouped = {}
    for (const row of functionPeople) {
      if (!grouped[row.function_id]) grouped[row.function_id] = []
      grouped[row.function_id].push(row)
    }
    return grouped
  }, [functionPeople])

  const filteredAreas = useMemo(() => {
    return areas.filter((area) => {
      const areaFns = functions.filter((fn) => fn.area_id === area.id).map((fn) => `${fn.name} ${fn.description ?? ''} ${fn.notes ?? ''}`).join(' ')
      const peopleText = (areaPeopleByArea[area.id] ?? []).map((x) => x.person?.name ?? '').join(' ')
      return `${area.name} ${area.description ?? ''} ${area.notes ?? ''} ${areaFns} ${peopleText}`.toLowerCase().includes(search.trim().toLowerCase())
    })
  }, [areas, functions, areaPeopleByArea, search])

  const peopleData = useMemo(() => {
    const peopleMap = new Map()
    function ensure(person) {
      if (!person?.id) return null
      if (!peopleMap.has(person.id)) peopleMap.set(person.id, { id: person.id, name: person.name ?? 'Sem nome', areas: [], functions: [], tasks: [] })
      return peopleMap.get(person.id)
    }
    for (const row of areaPeople) {
      const p = ensure(row.person)
      if (!p) continue
      p.areas.push(areaMap.get(row.area_id)?.name ?? '')
    }
    for (const row of functionPeople) {
      const p = ensure(row.person)
      const fn = functionMap.get(row.function_id)
      if (!p || !fn) continue
      p.functions.push(`${areaMap.get(fn.area_id)?.name ?? 'Sem área'}: ${fn.name}`)
    }
    for (const row of workItemPeople) {
      const p = ensure(row.person)
      const item = workItemMap.get(row.work_item_id)
      if (!p || !item) continue
      const project = findProject(item, workItemMap)
      if (item.type === 'project') {
        p.tasks.push({ id: row.id, projectName: item.name, label: `[${item.name}]`, state: projectPendingLabel(item.id), incoming: [], outgoing: [] })
      } else {
        const incoming = (dependenciesBySuccessor.get(item.id) ?? []).map((dep) => ({ dep, item: workItemMap.get(dep.predecessor_work_item_id) }))
        const outgoing = (dependenciesByPredecessor.get(item.id) ?? []).map((dep) => ({ dep, item: workItemMap.get(dep.successor_work_item_id) }))
        p.tasks.push({
          id: row.id,
          projectName: project?.name ?? 'Sem projeto',
          label: `[${item.name}]`,
          state: taskState(item, dependenciesBySuccessor, workItemMap),
          incoming,
          outgoing,
        })
      }
    }
    const arr = Array.from(peopleMap.values()).filter((person) => `${person.name} ${person.areas.join(' ')} ${person.functions.join(' ')} ${person.tasks.map((x)=>x.projectName+' '+x.label).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()))
    arr.sort((a,b)=>a.name.localeCompare(b.name,'pt'))
    return arr
  }, [areaPeople, functionPeople, workItemPeople, areaMap, functionMap, workItemMap, dependenciesBySuccessor, dependenciesByPredecessor, search])

  function renderFunctionList(areaId, parentId = '', depth = 0) {
    const items = functionsByAreaParent.get(`${areaId}::${parentId}`) ?? []
    if (!items.length) return null
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map((fn) => (
          <div key={fn.id} style={{ marginLeft: depth * 14, textAlign: 'left' }}>
            <div style={{ fontSize: 13, lineHeight: 1.35 }}>{fn.name}</div>
            {(functionPeopleByFunction[fn.id] ?? []).length ? <div style={{ fontSize: 11, color: '#5f6f66', marginTop: 2 }}>{(functionPeopleByFunction[fn.id] ?? []).map((x) => x.person?.name).filter(Boolean).join(', ')}</div> : null}
            {renderFunctionList(areaId, fn.id, depth + 1)}
          </div>
        ))}
      </div>
    )
  }

  function renderAreasView() {
    const openAreas = filteredAreas.filter((area) => openAreaIds.includes(area.id))
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <aside style={{ position: 'sticky', top: 16, alignSelf: 'start' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setOpenAreaIds(filteredAreas.map((x) => x.id))} style={{ padding:'6px 10px', ...pillStyle('ready') }}>+</button>
            <button onClick={() => setOpenAreaIds([])} style={{ padding:'6px 10px', ...pillStyle('waiting') }}>−</button>
          </div>
          <div style={{ ...cardStyle(), width: 250, minWidth: 250, maxWidth: 250 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              {filteredAreas.map((area) => (
                <button key={area.id} style={{ padding:'8px 10px', borderRadius:8, border:'1px solid #dfe7da', background:openAreaIds.includes(area.id)?'#e8f2e0':'#fff', textAlign:'left', cursor:'pointer' }} onClick={() => setOpenAreaIds((prev) => prev.includes(area.id) ? prev.filter((x)=>x!==area.id) : [...prev, area.id])}>{openAreaIds.includes(area.id) ? '−' : '+'} {area.name}</button>
              ))}
            </div>
          </div>
        </aside>
        <div style={{ overflowX: 'auto', paddingBottom: 10 }}>
          {openAreas.length ? (
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', width: 'max-content' }}>
              {openAreas.map((area) => (
                <section key={area.id} style={cardStyle()}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:20, fontWeight:700, lineHeight:1.05 }}>{area.name}</div>
                      {(areaPeopleByArea[area.id] ?? []).length ? <div style={{ fontSize:12, color:'#5f6f66', marginTop:4 }}>{(areaPeopleByArea[area.id] ?? []).map((x)=>x.person?.name).filter(Boolean).join(', ')}</div> : null}
                    </div>
                    <button style={{ padding:'6px 10px', borderRadius:999, border:'1px solid #d9e3d3', background:'#fff', cursor:'pointer', fontSize:12 }} onClick={() => setOpenAreaIds((prev) => prev.filter((x)=>x!==area.id))}>−</button>
                  </div>
                  {area.description ? <div style={{ fontSize:12, color:'#35513c', marginBottom:8 }}>{area.description}</div> : null}
                  {area.notes ? <div style={{ fontSize:12, color:'#5f6f66', marginBottom:8 }}>{area.notes}</div> : null}
                  {renderFunctionList(area.id)}
                </section>
              ))}
            </div>
          ) : <div style={cardStyle()}>Escolhe uma ou mais áreas à esquerda.</div>}
        </div>
      </div>
    )
  }

  function renderPeopleView() {
    const openPeople = peopleData.filter((person) => openPersonIds.includes(person.id))
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <aside style={{ position: 'sticky', top: 16, alignSelf: 'start' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setOpenPersonIds(peopleData.map((x) => x.id))} style={{ padding:'6px 10px', ...pillStyle('ready') }}>+</button>
            <button onClick={() => setOpenPersonIds([])} style={{ padding:'6px 10px', ...pillStyle('waiting') }}>−</button>
          </div>
          <div style={{ ...cardStyle(), width: 250, minWidth: 250, maxWidth: 250 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              {peopleData.map((person) => (
                <button key={person.id} style={{ padding:'8px 10px', borderRadius:8, border:'1px solid #dfe7da', background:openPersonIds.includes(person.id)?'#e8f2e0':'#fff', textAlign:'left', cursor:'pointer' }} onClick={() => setOpenPersonIds((prev) => prev.includes(person.id) ? prev.filter((x)=>x!==person.id) : [...prev, person.id])}>{openPersonIds.includes(person.id) ? '−' : '+'} {person.name}</button>
              ))}
            </div>
          </div>
        </aside>
        <div style={{ overflowX: 'auto', paddingBottom: 10 }}>
          {openPeople.length ? (
            <div style={{ display:'flex', gap:14, alignItems:'flex-start', width:'max-content' }}>
              {openPeople.map((person) => (
                <section key={person.id} style={cardStyle()}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:10 }}>
                    <div style={{ fontSize:20, fontWeight:700, lineHeight:1.05 }}>{person.name}</div>
                    <button style={{ padding:'6px 10px', borderRadius:999, border:'1px solid #d9e3d3', background:'#fff', cursor:'pointer', fontSize:12 }} onClick={() => setOpenPersonIds((prev) => prev.filter((x)=>x!==person.id))}>−</button>
                  </div>
                  {person.areas.length ? <div style={{ ...cardStyle(), width:'auto', minWidth:'auto', maxWidth:'none', padding:10, marginBottom:10 }}><div style={{ fontSize:11, fontWeight:700, color:'#35513c', marginBottom:6, textTransform:'uppercase' }}>Responsável por áreas</div><div style={{ display:'grid', gap:4 }}>{person.areas.map((item, i)=><div key={i} style={{ fontSize:12 }}>{item}</div>)}</div></div> : null}
                  {person.functions.length ? <div style={{ ...cardStyle(), width:'auto', minWidth:'auto', maxWidth:'none', padding:10, marginBottom:10 }}><div style={{ fontSize:11, fontWeight:700, color:'#35513c', marginBottom:6, textTransform:'uppercase' }}>Responsável por funções</div><div style={{ display:'grid', gap:4 }}>{person.functions.map((item, i)=><div key={i} style={{ fontSize:12 }}>{item}</div>)}</div></div> : null}
                  {person.tasks.length ? <div style={{ display:'grid', gap:8 }}>{person.tasks.map((task) => (
                    <div key={task.id} style={{ border:'1px solid #e8eee4', borderRadius:10, padding:'10px 10px 9px', background:'#fbfcfa', textAlign:'left' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center' }}>
                        <div style={{ fontSize:13, lineHeight:1.35 }}>{task.label}</div>
                        <span style={pillStyle(task.state === 'concluída' ? 'done' : task.state === 'em curso' ? 'in_progress' : task.state === 'à espera de dependências' ? 'waiting' : 'ready')}>{task.state}</span>
                      </div>
                      <div style={{ fontSize:12, color:'#35513c', marginTop:4 }}>Projeto: {task.projectName}</div>
                      {task.incoming?.length ? <div style={{ marginTop:8 }}><div style={{ fontSize:11, fontWeight:700, color:'#35513c', marginBottom:4, textTransform:'uppercase' }}>O que bloqueia a tarefa</div>{task.incoming.map(({ dep, item }) => <div key={dep.id} style={{ fontSize:12, marginBottom:4 }}>{dependencySentence(item?.name ?? 'Sem origem', task.label.replace(/^[\[]|\]$/g,''), dep.dependency_type)}</div>)}</div> : null}
                      {task.outgoing?.length ? <div style={{ marginTop:8 }}><div style={{ fontSize:11, fontWeight:700, color:'#35513c', marginBottom:4, textTransform:'uppercase' }}>O que esta tarefa bloqueia</div>{task.outgoing.map(({ dep, item }) => <div key={dep.id} style={{ fontSize:12, marginBottom:4 }}>{dependencySentence(task.label.replace(/^[\[]|\]$/g,''), item?.name ?? 'Sem destino', dep.dependency_type, true)}</div>)}</div> : null}
                    </div>
                  ))}</div> : null}
                </section>
              ))}
            </div>
          ) : <div style={cardStyle()}>Escolhe uma ou mais pessoas à esquerda.</div>}
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        :root { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:#1d2a21; background:#f6f8f4; }
        html, body, #root { margin:0; min-width:100%; min-height:100%; width:100%; }
        body { display:block; background:#f6f8f4; color:#1d2a21; }
        * { box-sizing:border-box; }
        button { font:inherit; }
      `}</style>
      <div style={{ minHeight:'100vh', background:'#f6f8f4', padding:'24px 18px 36px' }}>
        <div style={{ maxWidth:1800, margin:'0 auto' }}>
          <header style={{ marginBottom:18, textAlign:'left' }}>
            <img src="https://img.brainstormphda.pt/marca/logo/BPHDA_logo_pt_horizontal_verde.svg" alt="BPHDA" style={{ display:'block', height:34, width:'auto', marginBottom:14 }} />
            <h1 style={{ margin:0, fontSize:26, lineHeight:1.05, color:'#16361f', textAlign:'left' }}>Áreas, funções e responsáveis</h1>
          </header>
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            <button onClick={() => setActiveView('areas')} style={{ padding:'6px 10px', borderRadius:999, border: activeView === 'areas' ? '1px solid #b7cda8' : '1px solid #d9e3d3', background: activeView === 'areas' ? '#e8f2e0' : '#fff', cursor:'pointer', fontSize:12 }}>Ver por áreas</button>
            <button onClick={() => setActiveView('people')} style={{ padding:'6px 10px', borderRadius:999, border: activeView === 'people' ? '1px solid #b7cda8' : '1px solid #d9e3d3', background: activeView === 'people' ? '#e8f2e0' : '#fff', cursor:'pointer', fontSize:12 }}>Ver por pessoa</button>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no UI" style={{ padding:'8px 10px', borderRadius:8, border:'1px solid #cfd9ca', background:'#fff', fontSize:13, minWidth:240 }} />
          </div>
          {loading ? <div style={cardStyle()}>A carregar...</div> : null}
          {!loading && error ? <div style={{ ...cardStyle(), background:'#fff4f4', borderColor:'#efcaca', color:'#8a2f2f' }}>{error}</div> : null}
          {!loading && !error ? (activeView === 'areas' ? renderAreasView() : renderPeopleView()) : null}
        </div>
      </div>
    </>
  )
}
