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

function incomingDependencySummary(predecessorName, type) {
  if (type === 'finish_to_start') return `[${predecessorName}] e só pode começar depois desta terminar`
  if (type === 'start_to_start') return `[${predecessorName}] e só pode começar quando esta começar`
  if (type === 'finish_to_finish') return `[${predecessorName}] e só pode terminar depois desta terminar`
  if (type === 'blocks') return `[${predecessorName}] enquanto esta não estiver resolvida`
  return `[${predecessorName}]`
}

function outgoingDependencySummary(successorName, type) {
  if (type === 'finish_to_start') return `Bloqueia [${successorName}] e esta só pode começar depois da anterior terminar`
  if (type === 'start_to_start') return `Bloqueia [${successorName}] e esta só pode começar quando a anterior começar`
  if (type === 'finish_to_finish') return `Bloqueia [${successorName}] e esta só pode terminar depois da anterior terminar`
  if (type === 'blocks') return `Bloqueia [${successorName}] enquanto a anterior não estiver resolvida`
  return `Relacionada com [${successorName}]`
}

function taskState(task, dependenciesBySuccessor, workItemMap) {
  if (task.status === 'done') return 'concluída'
  if (task.status === 'cancelled') return 'cancelada'
  if (task.status === 'in_progress') return 'em curso'
  if (task.status === 'blocked') return 'bloqueada'
  const deps = dependenciesBySuccessor.get(task.id) ?? []
  const unresolved = deps.some((dep) => !isResolved(dep.dependency_type, workItemMap.get(dep.predecessor_work_item_id)?.status))
  return unresolved ? 'BLOQUEADA' : 'pode começar'
}

function pillStyle(kind) {
  const map = {
    done: { background: '#dcefdc', border: '1px solid #6f9472', color: '#16361f' },
    waiting: { background: '#efe0bf', border: '1px solid #9a6f16', color: '#4a3400' },
    ready: { background: '#dcefd8', border: '1px solid #6f9472', color: '#16361f' },
    in_progress: { background: '#dce7f7', border: '1px solid #6c89bb', color: '#173b6c' },
  }
  return { padding: '5px 10px', borderRadius: 999, fontSize: 11, lineHeight: 1.1, fontWeight: 700, ...map[kind] }
}

function cardStyle() {
  return {
    flex: '0 0 500px',
    width: 500,
    maxWidth: 500,
    minWidth: 500,
    background: '#ffffff',
    border: '1px solid #b8c9b5',
    borderRadius: 16,
    padding: 16,
    boxShadow: '0 2px 6px rgba(16,24,40,0.06)',
    overflow: 'hidden',
    textAlign: 'left',
  }
}

function groupTasksByProject(tasks) {
  const groups = []
  const map = new Map()
  for (const task of tasks) {
    const key = task.projectName || 'Sem projeto'
    if (!map.has(key)) {
      const group = { projectName: key, tasks: [], projectEntries: [] }
      map.set(key, group)
      groups.push(group)
    }
    if (task.isProject) map.get(key).projectEntries.push(task)
    else map.get(key).tasks.push(task)
  }
  return groups
}

function workItemTypeLabel(type) {
  const labels = {
    project: 'Projeto',
    task: 'Tarefa',
    subtask: 'Subtarefa',
    milestone: 'Marco',
  }
  return labels[type] ?? type ?? 'Item'
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
  const [openProjectIds, setOpenProjectIds] = useState([])
  const [collapsedPersonSections, setCollapsedPersonSections] = useState({})
  const [collapsedPersonProjects, setCollapsedPersonProjects] = useState({})
  const [expandedPersonAreaCards, setExpandedPersonAreaCards] = useState({})
  const [collapsedPersonTasks, setCollapsedPersonTasks] = useState({})
  const [collapsedProjectTasks, setCollapsedProjectTasks] = useState({})
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
    for (const list of map.values()) list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'pt'))
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
      rows.sort((a, b) => (a.is_primary === b.is_primary ? (a.person?.name ?? '').localeCompare(b.person?.name ?? '', 'pt') : a.is_primary ? -1 : 1))
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

  const filteredProjects = useMemo(() => {
    return workItems.filter((item) => {
      if (item.type !== 'project') return false
      const pending = projectPendingLabel(item.id)
      return `${item.name} ${item.description ?? ''} ${pending}`.toLowerCase().includes(search.trim().toLowerCase())
    })
  }, [workItems, search, primaryPersonByWorkItem, childrenByParent])

  const projectsData = useMemo(() => {
    return filteredProjects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description ?? '',
      pendingLabel: projectPendingLabel(project.id),
    }))
  }, [filteredProjects, primaryPersonByWorkItem, childrenByParent])

  const peopleData = useMemo(() => {
    const peopleMap = new Map()

    function ensure(person) {
      if (!person?.id) return null
      if (!peopleMap.has(person.id)) {
        peopleMap.set(person.id, {
          id: person.id,
          name: person.name ?? 'Sem nome',
          areasMap: new Map(),
          functions: [],
          tasks: [],
        })
      }
      return peopleMap.get(person.id)
    }

    function ensureAreaBucket(personEntry, areaId) {
      const key = areaId || '__sem_area__'
      if (!personEntry.areasMap.has(key)) {
        personEntry.areasMap.set(key, {
          id: areaId || '',
          name: areaMap.get(areaId)?.name ?? 'Sem área',
        })
      }
      return personEntry.areasMap.get(key)
    }

    for (const row of areaPeople) {
      const p = ensure(row.person)
      if (!p) continue
      ensureAreaBucket(p, row.area_id)
    }

    for (const row of functionPeople) {
      const p = ensure(row.person)
      const fn = functionMap.get(row.function_id)
      if (!p || !fn) continue
      ensureAreaBucket(p, fn.area_id)
      p.functions.push(`${areaMap.get(fn.area_id)?.name ?? 'Sem área'}: ${fn.name}`)
    }

    for (const row of workItemPeople) {
      const p = ensure(row.person)
      const item = workItemMap.get(row.work_item_id)
      if (!p || !item) continue
      const project = findProject(item, workItemMap)

      if (item.type === 'project') {
        p.tasks.push({
          id: row.id,
          projectName: item.name,
          label: `[${item.name}]`,
          state: projectPendingLabel(item.id),
          incoming: [],
          outgoing: [],
          isProjectAssignment: true,
        })
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
          isProjectAssignment: false,
        })
      }
    }

    const arr = Array.from(peopleMap.values()).map((person) => ({
      id: person.id,
      name: person.name,
      areas: Array.from(person.areasMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt')),
      functions: [...new Set(person.functions)].sort((a, b) => a.localeCompare(b, 'pt')),
      tasks: person.tasks,
    })).filter((person) => {
      const areasText = person.areas.map((area) => area.name).join(' ')
      return `${person.name} ${areasText} ${person.functions.join(' ')} ${person.tasks.map((x) => x.projectName + ' ' + x.label).join(' ')}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    })

    arr.sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    return arr
  }, [areaPeople, functionPeople, workItemPeople, areaMap, functionMap, workItemMap, dependenciesBySuccessor, dependenciesByPredecessor, search])


  function openPersonFromUI(personId) {
    if (!personId) return
    setActiveView('people')
    setCollapsedPersonSections((prev) => ({ ...prev, [`${personId}:projects`]: true }))
    setCollapsedPersonProjects((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${personId}:`)) next[key] = true
      })
      return next
    })
    setOpenPersonIds((prev) => prev.includes(personId) ? prev : [...prev, personId])
  }

  function togglePersonSection(personId, sectionKey) {
    const key = `${personId}:${sectionKey}`
    const current = collapsedPersonSections[key]
    const nextValue = current === undefined ? false : !current
    setCollapsedPersonSections((prev) => ({ ...prev, [key]: nextValue }))
  }

  function isPersonSectionCollapsed(personId, sectionKey, defaultCollapsed = false) {
    const value = collapsedPersonSections[`${personId}:${sectionKey}`]
    return value === undefined ? defaultCollapsed : !!value
  }

  function togglePersonProject(personId, projectName) {
    const key = `${personId}:${projectName}`
    setCollapsedPersonProjects((prev) => {
      const current = prev[key]
      return { ...prev, [key]: current === undefined ? false : !current }
    })
  }

  function isPersonProjectCollapsed(personId, projectName, defaultCollapsed = true) {
    const value = collapsedPersonProjects[`${personId}:${projectName}`]
    return value === undefined ? defaultCollapsed : !!value
  }

  function togglePersonAreaCard(personId, areaId) {
    const key = `${personId}:${areaId}`
    setExpandedPersonAreaCards((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function isPersonAreaCardExpanded(personId, areaId) {
    return !!expandedPersonAreaCards[`${personId}:${areaId}`]
  }

  function togglePersonTask(personId, taskId) {
    const key = `${personId}:${taskId}`
    setCollapsedPersonTasks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function isPersonTaskCollapsed(personId, taskId, defaultCollapsed = true) {
    const value = collapsedPersonTasks[`${personId}:${taskId}`]
    return value === undefined ? defaultCollapsed : !!value
  }

  function toggleProjectTask(projectId, taskId) {
    const key = `${projectId}:${taskId}`
    setCollapsedProjectTasks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function isProjectTaskCollapsed(projectId, taskId, defaultCollapsed = true) {
    const value = collapsedProjectTasks[`${projectId}:${taskId}`]
    return value === undefined ? defaultCollapsed : !!value
  }


  function renderFunctionList(areaId, parentId = '', depth = 0, visited = new Set()) {
    const branchKey = `${areaId}::${parentId || '__root__'}`
    if (visited.has(branchKey)) {
      return (
        <div style={{ marginLeft: depth * 14, fontSize: 11, color: '#7c1f1f' }}>
          Estrutura de funções com ciclo detetado.
        </div>
      )
    }

    const items = functionsByAreaParent.get(`${areaId}::${parentId}`) ?? []
    if (!items.length) return null

    const nextVisited = new Set(visited)
    nextVisited.add(branchKey)

    return (
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((fn) => (
          <div key={fn.id} style={{ marginLeft: depth * 14, textAlign: 'left' }}>
            <div style={{ fontSize: 13, lineHeight: 1.35, fontWeight: 700, color: '#16361f' }}>
              {fn.name || 'Sem nome'}
            </div>

            {(functionPeopleByFunction[fn.id] ?? []).length ? (
              <div style={{ fontSize: 11, color: '#4d5f55', marginTop: 3 }}>
                {(functionPeopleByFunction[fn.id] ?? []).map((x, idx, arr) => (
                  <span key={x.id ?? `${fn.id}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => openPersonFromUI?.(x.person?.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        margin: 0,
                        cursor: x.person?.id ? 'pointer' : 'default',
                        color: '#35513c',
                        fontSize: 11
                      }}
                    >
                      {x.person?.name ?? 'Sem nome'}
                    </button>
                    {idx < arr.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            ) : null}

            {renderFunctionList(areaId, fn.id, depth + 1, nextVisited)}
          </div>
        ))}
      </div>
    )
  }

  function renderAreasView() {
    const openAreas = filteredAreas.filter((area) => openAreaIds.includes(area.id))

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <aside style={{ position: 'sticky', top: 16, alignSelf: 'start' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setOpenAreaIds(filteredAreas.map((x) => x.id))} style={{ padding:'6px 10px', ...pillStyle('ready') }}>+</button>
            <button onClick={() => setOpenAreaIds([])} style={{ padding:'6px 10px', ...pillStyle('waiting') }}>−</button>
          </div>

          <div style={{ ...cardStyle(), width: 260, minWidth: 260, maxWidth: 260, background:'#fff', border:'1px solid #b8c9b5' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              {filteredAreas.map((area) => (
                <button
                  key={area.id}
                  style={{
                    padding:'10px 12px',
                    borderRadius:10,
                    border:'1px solid #b8c9b5',
                    background:openAreaIds.includes(area.id) ? '#dcefd8' : '#fff',
                    color:'#16361f',
                    textAlign:'left',
                    cursor:'pointer',
                    fontWeight:600,
                    fontSize:13
                  }}
                  onClick={() => setOpenAreaIds((prev) => prev.includes(area.id) ? prev.filter((x)=>x!==area.id) : [...prev, area.id])}
                >
                  {openAreaIds.includes(area.id) ? '− ' : '+ '}
                  {area.name || 'Sem nome'}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div style={{ overflowX: 'auto', paddingBottom: 10 }}>
          {openAreas.length ? (
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', width: 'max-content' }}>
              {openAreas.map((area) => (
                <section key={area.id} style={{ ...cardStyle(), background:'#fff', border:'1px solid #b8c9b5' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:20, fontWeight:700, lineHeight:1.05, color:'#16361f' }}>
                        {area.name || 'Sem nome'}
                      </div>

                      {(areaPeopleByArea[area.id] ?? []).length ? (
                        <div style={{ fontSize:12, color:'#4d5f55', marginTop:4 }}>
                          {(areaPeopleByArea[area.id] ?? []).map((x, idx, arr) => (
                            <span key={x.id ?? `${area.id}-${idx}`}>
                              <button
                                type="button"
                                onClick={() => openPersonFromUI?.(x.person?.id)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  padding: 0,
                                  margin: 0,
                                  cursor: x.person?.id ? 'pointer' : 'default',
                                  color: '#35513c',
                                  fontSize: 12
                                }}
                              >
                                {x.person?.name ?? 'Sem nome'}
                              </button>
                              {idx < arr.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <button
                      style={{ padding:'6px 10px', borderRadius:999, border:'1px solid #b8c9b5', background:'#fff', color:'#16361f', cursor:'pointer', fontSize:12 }}
                      onClick={() => setOpenAreaIds((prev) => prev.filter((x)=>x!==area.id))}
                    >
                      −
                    </button>
                  </div>

                  {area.description ? <div style={{ fontSize:12, color:'#16361f', marginBottom:8 }}>{area.description}</div> : null}
                  {area.notes ? <div style={{ fontSize:12, color:'#4d5f55', marginBottom:8 }}>{area.notes}</div> : null}

                  {renderFunctionList(area.id)}
                </section>
              ))}
            </div>
          ) : (
            <div style={{ ...cardStyle(), background:'#fff', border:'1px solid #b8c9b5', color:'#16361f' }}>
              Escolhe uma ou mais áreas à esquerda.
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderProjectsView() {
    const openProjects = projectsData.filter((project) => openProjectIds.includes(project.id))

    function renderProjectTree(parentId, depth = 0, visited = new Set()) {
      const items = childrenByParent.get(parentId) ?? []
      if (!items.length) return null

      return (
        <div style={{ display:'grid', gap:6 }}>
          {items.map((item) => {
            const hasCycle = visited.has(item.id)
            const nextVisited = new Set(visited)
            nextVisited.add(item.id)
            const stateLabel = taskState(item, dependenciesBySuccessor, workItemMap)
            const stateKind =
              stateLabel === 'concluída'
                ? 'done'
                : stateLabel === 'em curso'
                  ? 'in_progress'
                  : stateLabel === 'BLOQUEADA'
                    ? 'waiting'
                    : 'ready'
            const responsibleName = primaryPersonByWorkItem.get(item.id)
            const taskCollapsed = isProjectTaskCollapsed(parentId, item.id, true)
            const incoming = dependenciesBySuccessor.get(item.id) ?? []
            const outgoing = dependenciesByPredecessor.get(item.id) ?? []

            return (
              <div key={item.id} style={{ display:'grid', gap:8 }}>
                <div
                  style={{
                    marginLeft: depth * 16,
                    border:'1px solid #d8e3d5',
                    borderRadius:10,
                    padding:'10px 12px',
                    background:'#fbfcfa',
                    borderLeft: depth > 0 ? '4px solid #dcefd8' : '1px solid #d8e3d5'
                  }}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start' }}>
                    <div style={{ display:'grid', gap:3, minWidth:0 }}>
                      <div style={{ fontSize:10.5, fontWeight:800, color:'#35513c', textTransform:'uppercase', letterSpacing:0.25 }}>
                        {workItemTypeLabel(item.type)}
                      </div>
                      <div style={{ fontSize:12.5, color:'#16361f', lineHeight:1.35, fontWeight:600, wordBreak:'break-word' }}>
                        {item.name}
                      </div>
                    </div>
                    <span style={pillStyle(stateKind)}>
                      {stateLabel}
                    </span>
                  </div>

                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', marginTop:6 }}>
                    {responsibleName ? (
                      <div style={{ fontSize:11, color:'#35513c', lineHeight:1.35 }}>
                        Responsável: {responsibleName}
                      </div>
                    ) : <div />}

                    <button
                      style={{ padding:'4px 8px', borderRadius:999, border:'1px solid #b8c9b5', background:'#fff', color:'#16361f', cursor:'pointer', fontSize:11 }}
                      onClick={() => toggleProjectTask(parentId, item.id)}
                    >
                      {taskCollapsed ? 'Mostrar' : 'Colapsar'}
                    </button>
                  </div>

                  {item.description ? (
                    <div style={{ fontSize:11, color:'#5f6f66', marginTop:6, lineHeight:1.4 }}>
                      {item.description}
                    </div>
                  ) : null}

                  {!taskCollapsed && incoming.length ? (
                    <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid #e3eadf' }}>
                      <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', marginBottom:6, textTransform:'uppercase' }}>
                        Tarefa bloqueada por:
                      </div>
                      <div style={{ display:'grid', gap:6 }}>
                        {incoming.map((dep) => {
                          const pred = workItemMap.get(dep.predecessor_work_item_id)
                          return (
                            <div key={dep.id} style={{ fontSize:12, color:'#16361f', lineHeight:1.38 }}>
                              {incomingDependencySummary(pred?.name ?? 'Sem origem', dep.dependency_type)}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {!taskCollapsed && outgoing.length ? (
                    <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid #e3eadf' }}>
                      <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', marginBottom:6, textTransform:'uppercase' }}>
                        O que esta tarefa bloqueia:
                      </div>
                      <div style={{ display:'grid', gap:6 }}>
                        {outgoing.map((dep) => {
                          const succ = workItemMap.get(dep.successor_work_item_id)
                          return (
                            <div key={dep.id} style={{ fontSize:12, color:'#16361f', lineHeight:1.38 }}>
                              {outgoingDependencySummary(succ?.name ?? 'Sem destino', dep.dependency_type)}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {hasCycle ? (
                    <div style={{ fontSize:11, color:'#8a5a12', marginTop:6, lineHeight:1.35 }}>
                      Ciclo detetado na hierarquia, expansão interrompida.
                    </div>
                  ) : null}
                </div>

                {!hasCycle ? renderProjectTree(item.id, depth + 1, nextVisited) : null}
              </div>
            )
          })}
        </div>
      )
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <aside style={{ position: 'sticky', top: 16, alignSelf: 'start' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setOpenProjectIds(projectsData.map((x) => x.id))} style={{ padding:'6px 10px', ...pillStyle('ready') }}>+</button>
            <button onClick={() => setOpenProjectIds([])} style={{ padding:'6px 10px', ...pillStyle('waiting') }}>−</button>
          </div>

          <div style={{ ...cardStyle(), width: 260, minWidth: 260, maxWidth: 260, background:'#fff', border:'1px solid #b8c9b5' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              {projectsData.map((project) => (
                <button
                  key={project.id}
                  style={{
                    padding:'10px 12px',
                    borderRadius:10,
                    border:'1px solid #b8c9b5',
                    background:openProjectIds.includes(project.id) ? '#dcefd8' : '#fff',
                    color:'#16361f',
                    textAlign:'left',
                    cursor:'pointer',
                    fontWeight:600,
                    fontSize:13
                  }}
                  onClick={() => setOpenProjectIds((prev) => prev.includes(project.id) ? prev.filter((x)=>x!==project.id) : [...prev, project.id])}
                >
                  {openProjectIds.includes(project.id) ? '−' : '+'} {project.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div style={{ overflowX: 'auto', paddingBottom: 10 }}>
          {openProjects.length ? (
            <div style={{ display:'flex', gap:14, alignItems:'flex-start', width:'max-content' }}>
              {openProjects.map((project) => (
                <section key={project.id} style={{ ...cardStyle(), background:'#fff', border:'1px solid #b8c9b5' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start', marginBottom:10 }}>
                    <div style={{ fontSize:20, fontWeight:700, lineHeight:1.05, color:'#16361f' }}>{project.name}</div>
                    <button
                      style={{ padding:'6px 10px', borderRadius:999, border:'1px solid #b8c9b5', background:'#fff', color:'#16361f', cursor:'pointer', fontSize:12 }}
                      onClick={() => setOpenProjectIds((prev) => prev.filter((x)=>x!==project.id))}
                    >
                      −
                    </button>
                  </div>

                  {project.description ? (
                    <div style={{ fontSize:12, color:'#35513c', marginBottom:12, lineHeight:1.4 }}>
                      {project.description}
                    </div>
                  ) : null}

                  <div style={{ border:'1px solid #cfd9ca', borderRadius:12, padding:12, background:'#fff', marginBottom:12 }}>
                    <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', textTransform:'uppercase', letterSpacing:0.3, marginBottom:6 }}>
                      Pendentes
                    </div>
                    <div style={{ fontSize:12, color:'#16361f', lineHeight:1.38 }}>
                      {project.pendingLabel}
                    </div>
                  </div>

                  <div style={{ border:'1px solid #cfd9ca', borderRadius:12, padding:12, background:'#fff' }}>
                    <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', textTransform:'uppercase', letterSpacing:0.3, marginBottom:8 }}>
                      Tarefas
                    </div>
                    {renderProjectTree(project.id) ?? (
                      <div style={{ fontSize:12, color:'#5f6f66' }}>
                        Sem tarefas neste projeto.
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : <div style={cardStyle()}>Escolhe um ou mais projetos à esquerda.</div>}
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
                <button
                  key={person.id}
                  style={{ padding:'8px 10px', borderRadius:8, border:'1px solid #b8c9b5', background:openPersonIds.includes(person.id)?'#dcefd8':'#fff', color:'#16361f', textAlign:'left', cursor:'pointer', fontWeight:600, fontSize:12 }}
                  onClick={() => setOpenPersonIds((prev) => prev.includes(person.id) ? prev.filter((x)=>x!==person.id) : [...prev, person.id])}
                >
                  {openPersonIds.includes(person.id) ? '−' : '+'} {person.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div style={{ overflowX: 'auto', paddingBottom: 10 }}>
          {openPeople.length ? (
            <div style={{ display:'flex', gap:14, alignItems:'flex-start', width:'max-content' }}>
              {openPeople.map((person) => {
                const groupedProjectsMap = new Map()
                for (const task of person.tasks) {
                  const key = task.projectName || 'Sem projeto'
                  if (!groupedProjectsMap.has(key)) groupedProjectsMap.set(key, [])
                  groupedProjectsMap.get(key).push(task)
                }
                const groupedProjects = Array.from(groupedProjectsMap.entries())
                const areasCollapsed = isPersonSectionCollapsed(person.id, 'areas', true)
                const functionsCollapsed = isPersonSectionCollapsed(person.id, 'functions', true)
                const projectsCollapsed = isPersonSectionCollapsed(person.id, 'projects', true)

                return (
                  <section key={person.id} style={{ ...cardStyle(), background:'#fff', border:'1px solid #b8c9b5' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:10 }}>
                      <div style={{ fontSize:20, fontWeight:700, lineHeight:1.05, color:'#16361f' }}>{person.name}</div>
                      <button style={{ padding:'6px 10px', borderRadius:999, border:'1px solid #b8c9b5', background:'#fff', color:'#16361f', cursor:'pointer', fontSize:12 }} onClick={() => setOpenPersonIds((prev) => prev.filter((x)=>x!==person.id))}>−</button>
                    </div>

                    {person.areas.length ? (
                      <div style={{ border:'1px solid #cfd9ca', borderRadius:12, padding:12, marginBottom:12, background:'#fff' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', marginBottom:areasCollapsed ? 0 : 8 }}>
                          <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', textTransform:'uppercase', letterSpacing:0.3 }}>Responsável por áreas</div>
                          <button style={{ padding:'4px 8px', borderRadius:999, border:'1px solid #b8c9b5', background:'#fff', color:'#16361f', cursor:'pointer', fontSize:11 }} onClick={() => togglePersonSection(person.id, 'areas')}>
                            {areasCollapsed ? 'Mostrar' : 'Colapsar'}
                          </button>
                        </div>

                        {!areasCollapsed ? (
                          <div style={{ display:'grid', gap:8 }}>
                            {person.areas.map((area) => {
                              const areaKey = area.id || area.name
                              const expanded = isPersonAreaCardExpanded(person.id, areaKey)
                              const areaFunctions = functions
                                .filter((fn) => fn.area_id === area.id && !fn.parent_function_id)
                                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'pt'))

                              return (
                                <div key={areaKey} style={{ border:'1px solid #d9e3d3', borderRadius:10, background:'#fbfcfa', overflow:'hidden' }}>
                                  <button
                                    type="button"
                                    onClick={() => togglePersonAreaCard(person.id, areaKey)}
                                    style={{ width:'100%', padding:'10px 12px', border:'none', background:'#f4f7f2', cursor:'pointer', textAlign:'left', fontSize:12, fontWeight:700, color:'#16361f' }}
                                  >
                                    {expanded ? '− ' : '+ '}{area.name}
                                  </button>

                                  {expanded ? (
                                    <div style={{ padding:12, display:'grid', gap:8 }}>
                                      {areaFunctions.length ? (
                                        areaFunctions.map((fn) => (
                                          <div key={fn.id} style={{ border:'1px solid #e1e9dc', borderRadius:10, padding:'10px 10px 9px', background:'#fff' }}>
                                            <div style={{ fontSize:13, fontWeight:700, color:'#16361f' }}>{fn.name}</div>
                                            <div style={{ fontSize:11, color:'#4d5f55', marginTop:4 }}>
                                              {(functionPeopleByFunction[fn.id] ?? []).length
                                                ? (functionPeopleByFunction[fn.id] ?? []).map((x) => x.person?.name).filter(Boolean).join(', ')
                                                : 'Sem responsável'}
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div style={{ fontSize:12, color:'#4d5f55' }}>Sem funções nesta área.</div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {person.functions.length ? (
                      <div style={{ border:'1px solid #cfd9ca', borderRadius:12, padding:12, marginBottom:12, background:'#fff' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', marginBottom:functionsCollapsed ? 0 : 8 }}>
                          <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', textTransform:'uppercase', letterSpacing:0.3 }}>Responsável por funções</div>
                          <button style={{ padding:'4px 8px', borderRadius:999, border:'1px solid #b8c9b5', background:'#fff', color:'#16361f', cursor:'pointer', fontSize:11 }} onClick={() => togglePersonSection(person.id, 'functions')}>
                            {functionsCollapsed ? 'Mostrar' : 'Colapsar'}
                          </button>
                        </div>
                        {!functionsCollapsed ? (
                          <div style={{ display:'grid', gap:4 }}>
                            {person.functions.map((item, i) => <div key={i} style={{ fontSize:12, color:'#16361f' }}>{item}</div>)}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {groupedProjects.length ? (
                      <div style={{ border:'1px solid #cfd9ca', borderRadius:12, padding:12, background:'#fff' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', marginBottom:projectsCollapsed ? 0 : 10 }}>
                          <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', textTransform:'uppercase', letterSpacing:0.3 }}>Projetos</div>
                          <button style={{ padding:'4px 8px', borderRadius:999, border:'1px solid #b8c9b5', background:'#fff', color:'#16361f', cursor:'pointer', fontSize:11 }} onClick={() => togglePersonSection(person.id, 'projects')}>
                            {projectsCollapsed ? 'Mostrar' : 'Colapsar'}
                          </button>
                        </div>

                        {!projectsCollapsed ? (
                          <div style={{ display:'grid', gap:10 }}>
                            {groupedProjects.map(([projectName, tasks]) => {
                              const collapsed = isPersonProjectCollapsed(person.id, projectName, true)
                              return (
                                <div key={`${person.id}-${projectName}`} style={{ border:'1px solid #d9e3d3', borderRadius:12, background:'#fff', overflow:'hidden' }}>
                                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', padding:'10px 12px', background:'#f4f7f2' }}>
                                    <div style={{ fontSize:12, fontWeight:800, color:'#16361f' }}>Projeto: {projectName}</div>
                                    <button style={{ padding:'4px 8px', borderRadius:999, border:'1px solid #b8c9b5', background:'#fff', color:'#16361f', cursor:'pointer', fontSize:11 }} onClick={() => togglePersonProject(person.id, projectName)}>
                                      {collapsed ? 'Mostrar' : 'Colapsar'}
                                    </button>
                                  </div>

                                  {!collapsed ? (
                                    <div style={{ display:'grid', gap:8, padding:12 }}>
                                      {tasks.map((task) => {
                                        const taskCollapsed = isPersonTaskCollapsed(person.id, task.id)
                                        return (
                                          <div key={task.id} style={{ border:'1px solid #e1e9dc', borderRadius:10, padding:'10px 10px 9px', background:'#fbfcfa', textAlign:'left' }}>
                                            <div style={{ display:'grid', gap:6 }}>
                                              <div style={{ fontSize:13, lineHeight:1.35, color:'#16361f', fontWeight:600 }}>
                                                {task.isProjectAssignment ? `Projeto: ${task.projectName}` : `Tarefa: ${task.label}`}
                                              </div>
                                              <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center' }}>
                                                <span style={pillStyle(task.state === 'concluída' ? 'done' : task.state === 'em curso' ? 'in_progress' : task.state === 'BLOQUEADA' ? 'waiting' : 'ready')}>{task.state}</span>
                                                {!task.isProjectAssignment ? (
                                                  <button style={{ padding:'4px 8px', borderRadius:999, border:'1px solid #b8c9b5', background:'#fff', color:'#16361f', cursor:'pointer', fontSize:11 }} onClick={() => togglePersonTask(person.id, task.id)}>
                                                    {taskCollapsed ? 'Mostrar' : 'Colapsar'}
                                                  </button>
                                                ) : null}
                                              </div>
                                            </div>

                                            {!task.isProjectAssignment && !taskCollapsed ? (
                                              <>
                                                {task.incoming?.length ? (
                                                  <div style={{ marginTop:8 }}>
                                                    <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', marginBottom:6, textTransform:'uppercase' }}>Tarefa bloqueada por:</div>
                                                    {task.incoming.map(({ dep, item }) => (
                                                      <div key={dep.id} style={{ fontSize:12, marginBottom:7, color:'#16361f', lineHeight:1.38 }}>
                                                        {incomingDependencySummary(item?.name ?? 'Sem origem', dep.dependency_type)}
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : null}

                                                {task.outgoing?.length ? (
                                                  <div style={{ marginTop:8 }}>
                                                    <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', marginBottom:6, textTransform:'uppercase' }}>O que esta tarefa bloqueia:</div>
                                                    {task.outgoing.map(({ dep, item }) => (
                                                      <div key={dep.id} style={{ fontSize:12, marginBottom:7, color:'#16361f', lineHeight:1.38 }}>
                                                        {outgoingDependencySummary(item?.name ?? 'Sem destino', dep.dependency_type)}
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : null}
                                              </>
                                            ) : null}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                )
              })}
            </div>
          ) : <div style={cardStyle()}>Escolhe uma ou mais pessoas à esquerda.</div>}
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        :root {
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #16361f;
          background: #f2f5ef;
        }
        html, body, #root {
          margin:0;
          min-width:100%;
          min-height:100%;
          width:100%;
        }
        body {
          display:block;
          background:#f2f5ef;
          color:#16361f;
        }
        * { box-sizing:border-box; }
        button, input { font:inherit; }
        input::placeholder { color:#5b6f60; opacity:1; }
      `}</style>

      <div style={{ minHeight:'100vh', background:'#f2f5ef', padding:'24px 18px 36px' }}>
        <div style={{ maxWidth:1800, margin:'0 auto' }}>
          <header style={{ marginBottom:18, textAlign:'left' }}>
            <img src="https://img.brainstormphda.pt/marca/logo/BPHDA_logo_pt_horizontal_verde.png" alt="BPHDA" style={{ display:'block', height:34, width:'auto', marginBottom:14 }} />
            <h1 style={{ margin:0, fontSize:26, lineHeight:1.05, color:'#16361f', textAlign:'left' }}>Áreas, funções e responsáveis</h1>
          </header>

          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
            <button onClick={() => setActiveView('areas')} style={{ padding:'8px 12px', borderRadius:999, border: activeView === 'areas' ? '1px solid #6e9575' : '1px solid #b8c9b5', background: activeView === 'areas' ? '#dcefd8' : '#fff', color:'#16361f', cursor:'pointer', fontSize:13, fontWeight:700 }}>ÁREAS</button>
            <button onClick={() => setActiveView('people')} style={{ padding:'8px 12px', borderRadius:999, border: activeView === 'people' ? '1px solid #6e9575' : '1px solid #b8c9b5', background: activeView === 'people' ? '#dcefd8' : '#fff', color:'#16361f', cursor:'pointer', fontSize:13, fontWeight:700 }}>PESSOAS</button>
            <button onClick={() => setActiveView('projects')} style={{ padding:'8px 12px', borderRadius:999, border: activeView === 'projects' ? '1px solid #6e9575' : '1px solid #b8c9b5', background: activeView === 'projects' ? '#dcefd8' : '#fff', color:'#16361f', cursor:'pointer', fontSize:13, fontWeight:700 }}>PROJETOS</button>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no UI" style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #b8c9b5', background:'#fff', color:'#16361f', fontSize:14, minWidth:260 }} />
          </div>

          {loading ? <div style={cardStyle()}>A carregar...</div> : null}
          {!loading && error ? <div style={{ ...cardStyle(), background:'#fff1f1', borderColor:'#d99c9c', color:'#7c1f1f' }}>{error}</div> : null}
          {!loading && !error ? (activeView === 'areas' ? renderAreasView() : activeView === 'people' ? renderPeopleView() : renderProjectsView()) : null}
        </div>
      </div>
    </>
  )
}
