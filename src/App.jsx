import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { ProjectVisualView } from './ProjectVisualViews'
import AuthGate from './AuthGate'

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

function countLabel(value, singular, plural) {
  return `${value} ${value === 1 ? singular : plural}`
}

function compactNavButtonStyle(active = false) {
  return {
    padding:'7px 10px',
    borderRadius:10,
    border:'1px solid #b8c9b5',
    background:active ? '#dcefd8' : '#fff',
    color:'#16361f',
    textAlign:'left',
    cursor:'pointer',
    fontWeight:600,
    fontSize:13,
    minHeight:36
  }
}

function collapseIconButtonStyle() {
  return {
    border:'none',
    background:'transparent',
    color:'#16361f',
    cursor:'pointer',
    fontSize:22,
    fontWeight:800,
    lineHeight:1,
    width:32,
    height:32,
    padding:0,
    display:'inline-flex',
    alignItems:'center',
    justifyContent:'center'
  }
}

function renderHighlightedText(text, query) {
  const value = String(text ?? '')
  const searchValue = String(query ?? '').trim()
  if (!value || !searchValue) return value

  const terms = Array.from(new Set(searchValue.split(/\s+/).filter(Boolean)))
  if (!terms.length) return value

  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = value.split(regex)

  return parts.map((part, index) => {
    if (!part) return null
    const isMatch = terms.some((term) => part.toLowerCase() === term.toLowerCase())
    return isMatch
      ? <span key={index} style={{ background:'#fff1a8', borderRadius:3, padding:'0 1px' }}>{part}</span>
      : <span key={index}>{part}</span>
  })
}

function normalizeForSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function matchesSearch(haystack, query) {
  const normalizedQuery = normalizeForSearch(query)
  if (!normalizedQuery) return true
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const normalizedHaystack = normalizeForSearch(haystack)
  return tokens.every((token) => normalizedHaystack.includes(token))
}

function personSearchSummary(person, query) {
  const q = String(query ?? '').trim()
  if (!q) return null

  const areasCount = (person.areas ?? []).filter((area) => {
    const name = typeof area === 'string' ? area : area?.name ?? ''
    return matchesSearch(name, q)
  }).length

  const functionsCount = (person.functions ?? []).filter((item) => matchesSearch(item, q)).length

  const projectNames = [...new Set((person.tasks ?? []).map((task) => task.projectName || 'Sem projeto'))]
  const projectsCount = projectNames.filter((name) => matchesSearch(name, q)).length

  const tasksCount = (person.tasks ?? []).filter((task) => {
    return matchesSearch(task.label ?? '', q) || matchesSearch(task.state ?? '', q)
  }).length

  const dependenciesCount = (person.tasks ?? []).reduce((total, task) => {
    const incomingMatches = (task.incoming ?? []).filter(({ dep, item }) =>
      matchesSearch(incomingDependencySummary(item?.name ?? 'Sem origem', dep.dependency_type), q)
    ).length

    const outgoingMatches = (task.outgoing ?? []).filter(({ dep, item }) =>
      matchesSearch(outgoingDependencySummary(item?.name ?? 'Sem destino', dep.dependency_type), q)
    ).length

    return total + incomingMatches + outgoingMatches
  }, 0)

  const entries = [
    areasCount ? `${areasCount} ${areasCount === 1 ? 'área' : 'áreas'}` : null,
    functionsCount ? `${functionsCount} ${functionsCount === 1 ? 'função' : 'funções'}` : null,
    projectsCount ? `${projectsCount} ${projectsCount === 1 ? 'projeto' : 'projetos'}` : null,
    tasksCount ? `${tasksCount} ${tasksCount === 1 ? 'tarefa' : 'tarefas'}` : null,
    dependenciesCount ? `${dependenciesCount} ${dependenciesCount === 1 ? 'dependência' : 'dependências'}` : null,
  ].filter(Boolean)

  if (!entries.length) return null

  return {
    text: entries.join(' · '),
    total: areasCount + functionsCount + projectsCount + tasksCount + dependenciesCount,
  }
}

function personSearchTargets(person, query) {
  const q = String(query ?? '').trim()
  if (!q) return []

  const targets = []

  ;(person.functions ?? []).forEach((item, index) => {
    if (matchesSearch(item, q)) {
      targets.push({
        key: `function-${index}`,
        label: `Função: ${item}`,
        targetId: `person-${person.id}-function-${index}`,
        section: 'functions',
      })
    }
  })

  const seenProjects = new Set()

  ;(person.tasks ?? []).forEach((task) => {
    const projectName = task.projectName || 'Sem projeto'

    if (matchesSearch(projectName, q) && !seenProjects.has(projectName)) {
      seenProjects.add(projectName)
      targets.push({
        key: `project-${projectName}`,
        label: `Projeto: ${projectName}`,
        targetId: `person-${person.id}-project-${projectName}`,
        section: 'projects',
        projectName,
      })
    }

    if (matchesSearch(task.label ?? '', q) || matchesSearch(task.state ?? '', q)) {
      targets.push({
        key: `task-${task.id}`,
        label: `Tarefa: ${task.label}`,
        targetId: `person-${person.id}-task-${task.id}`,
        section: 'projects',
        projectName,
        taskId: task.id,
      })
    }

    ;(task.incoming ?? []).forEach(({ dep, item }) => {
      const sentence = incomingDependencySummary(item?.name ?? 'Sem origem', dep.dependency_type)
      if (matchesSearch(sentence, q)) {
        targets.push({
          key: `incoming-${task.id}-${dep.id}`,
          label: `Dependência: ${sentence}`,
          targetId: `person-${person.id}-incoming-${task.id}-${dep.id}`,
          section: 'projects',
          projectName,
          taskId: task.id,
        })
      }
    })

    ;(task.outgoing ?? []).forEach(({ dep, item }) => {
      const sentence = outgoingDependencySummary(item?.name ?? 'Sem destino', dep.dependency_type)
      if (matchesSearch(sentence, q)) {
        targets.push({
          key: `outgoing-${task.id}-${dep.id}`,
          label: `Dependência: ${sentence}`,
          targetId: `person-${person.id}-outgoing-${task.id}-${dep.id}`,
          section: 'projects',
          projectName,
          taskId: task.id,
        })
      }
    })
  })

  return targets
}

function AppContent() {
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
  const [projectVisualModes, setProjectVisualModes] = useState({})
  const [search, setSearch] = useState('')
  const peopleSearchTargetRefs = useRef(new Map())
  const lastRefreshAtRef = useRef(0)
  const refreshInFlightRef = useRef(false)

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    function refreshIfNeeded() {
      if (document.visibilityState && document.visibilityState !== 'visible') return
      const now = Date.now()
      if (refreshInFlightRef.current) return
      if (now - lastRefreshAtRef.current < 1500) return
      loadData({ silent: true })
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') refreshIfNeeded()
    }

    window.addEventListener('focus', refreshIfNeeded)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', refreshIfNeeded)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  async function loadData(options = {}) {
    const silent = !!options.silent
    refreshInFlightRef.current = true
    lastRefreshAtRef.current = Date.now()
    if (!silent) setLoading(true)
    setError('')
    const [areasResult, functionsResult, areaPeopleResult, functionPeopleResult, workItemsResult, workItemPeopleResult, workItemDependenciesResult] = await Promise.all([
      supabase.from('areas').select('id, name, description, notes, sort_order').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('functions').select('id, area_id, parent_function_id, name, description, notes, sort_order').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('area_people').select('id, area_id, assignment_role, is_primary, person:people(id,name)'),
      supabase.from('function_people').select('id, function_id, assignment_role, is_primary, person:people(id,name)'),
      supabase.from('work_items').select('id, parent_work_item_id, type, name, description, due_date, status, sort_order').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('work_item_people').select('id, work_item_id, assignment_role, is_primary, person:people(id,name)'),
      supabase.from('work_item_dependencies').select('id, predecessor_work_item_id, successor_work_item_id, dependency_type, lag_days, note'),
    ])
    const all = [areasResult, functionsResult, areaPeopleResult, functionPeopleResult, workItemsResult, workItemPeopleResult, workItemDependenciesResult]
    const firstError = all.find((r) => r.error)
    if (firstError?.error) {
      setError(firstError.error.message)
      if (!silent) setLoading(false)
      refreshInFlightRef.current = false
      return
    }
    setAreas(areasResult.data ?? [])
    setFunctions(functionsResult.data ?? [])
    setAreaPeople(areaPeopleResult.data ?? [])
    setFunctionPeople(functionPeopleResult.data ?? [])
    setWorkItems(workItemsResult.data ?? [])
    setWorkItemPeople(workItemPeopleResult.data ?? [])
    setWorkItemDependencies(workItemDependenciesResult.data ?? [])
    if (!silent) setLoading(false)
    refreshInFlightRef.current = false
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
    const lines = []

    function walk(parentId, prefix = '') {
      const children = childrenByParent.get(parentId) ?? []
      children.forEach((child, index) => {
        const number = prefix ? `${prefix}.${index + 1}` : `${index + 1}`
        const grandchildren = childrenByParent.get(child.id) ?? []

        if (grandchildren.length) {
          walk(child.id, number)
          return
        }

        if (child.status === 'done' || child.status === 'cancelled') return
        lines.push(workItemLine(child, number))
      })
    }

    walk(projectId)
    return lines.length ? lines.join('\n') : 'concluído'
  }

  function workItemLine(item, prefix = '') {
    const responsible = primaryPersonByWorkItem.get(item.id) ?? ''
    const due = item.due_date ? `[${item.due_date}]` : ''
    const number = prefix ? `${prefix}. ` : ''
    return [number ? `${number}[${item.name}]` : `[${item.name}]`, responsible, due].filter(Boolean).join(' ')
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

  const areaStats = useMemo(() => {
    const stats = new Map()

    for (const area of areas) {
      stats.set(area.id, {
        functions: 0,
        peopleIds: new Set((areaPeopleByArea[area.id] ?? []).map((row) => row.person?.id).filter(Boolean)),
      })
    }

    for (const fn of functions) {
      if (!stats.has(fn.area_id)) stats.set(fn.area_id, { functions: 0, peopleIds: new Set() })
      const entry = stats.get(fn.area_id)
      entry.functions += 1

      for (const row of functionPeopleByFunction[fn.id] ?? []) {
        if (row.person?.id) entry.peopleIds.add(row.person.id)
      }
    }

    return stats
  }, [areas, functions, areaPeopleByArea, functionPeopleByFunction])

  const filteredAreas = useMemo(() => {
    return areas.filter((area) => {
      const areaFns = functions
        .filter((fn) => fn.area_id === area.id)
        .map((fn) => `${fn.name} ${fn.description ?? ''} ${fn.notes ?? ''}`)
        .join(' ')
      const peopleText = (areaPeopleByArea[area.id] ?? [])
        .map((x) => x.person?.name ?? '')
        .join(' ')
      return matchesSearch(
        `${area.name} ${area.description ?? ''} ${area.notes ?? ''} ${areaFns} ${peopleText}`,
        search
      )
    })
  }, [areas, functions, areaPeopleByArea, search])

  const filteredProjects = useMemo(() => {
    return workItems.filter((item) => {
      if (item.type !== 'project') return false
      const pending = projectPendingLabel(item.id)
      const projectChildren = collectPendingLeaves(item.id)
      const childText = projectChildren
        .map((child) => {
          const responsible = primaryPersonByWorkItem.get(child.id) ?? ''
          return `${child.name} ${child.description ?? ''} ${child.due_date ?? ''} ${responsible} ${taskState(child, dependenciesBySuccessor, workItemMap)}`
        })
        .join(' ')
      return matchesSearch(
        `${item.name} ${item.description ?? ''} ${pending} ${childText}`,
        search
      )
    })
  }, [workItems, search, primaryPersonByWorkItem, childrenByParent, dependenciesBySuccessor, workItemMap])

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
          line: workItemLine(item),
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
      const tasksText = person.tasks
        .map((x) => `${x.projectName} ${x.label} ${x.state ?? ''} ${x.incoming?.map(({ item }) => item?.name ?? '').join(' ') ?? ''} ${x.outgoing?.map(({ item }) => item?.name ?? '').join(' ') ?? ''}`)
        .join(' ')
      return matchesSearch(
        `${person.name} ${areasText} ${person.functions.join(' ')} ${tasksText}`,
        search
      )
    })

    arr.sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    return arr
  }, [areaPeople, functionPeople, workItemPeople, areaMap, functionMap, workItemMap, dependenciesBySuccessor, dependenciesByPredecessor, primaryPersonByWorkItem, search])


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
    setCollapsedPersonTasks((prev) => {
      const current = prev[key]
      return { ...prev, [key]: current === undefined ? false : !current }
    })
  }

  function isPersonTaskCollapsed(personId, taskId, defaultCollapsed = true) {
    const value = collapsedPersonTasks[`${personId}:${taskId}`]
    return value === undefined ? defaultCollapsed : !!value
  }

  function scrollToPersonSearchTarget(targetId, attempt = 0) {
    const tryScroll = () => {
      const el = peopleSearchTargetRefs.current.get(targetId)
      if (el) {
        el.scrollIntoView({ behavior:'smooth', block:'center', inline:'nearest' })
        return
      }
      if (attempt < 12) {
        window.setTimeout(() => scrollToPersonSearchTarget(targetId, attempt + 1), 120)
      }
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(tryScroll)
    })
  }

  function openPersonSearchTarget(personId, target) {
    if (!personId || !target) return

    setOpenPersonIds((prev) => prev.includes(personId) ? prev : [...prev, personId])

    if (target.section === 'functions') {
      setCollapsedPersonSections((prev) => ({ ...prev, [`${personId}:functions`]: false }))
    }

    if (target.section === 'projects') {
      setCollapsedPersonSections((prev) => ({ ...prev, [`${personId}:projects`]: false }))

      if (target.projectName) {
        setCollapsedPersonProjects((prev) => ({ ...prev, [`${personId}:${target.projectName}`]: false }))
      }

      if (target.taskId) {
        setCollapsedPersonTasks((prev) => ({ ...prev, [`${personId}:${target.taskId}`]: false }))
      }
    }

    scrollToPersonSearchTarget(target.targetId)
  }

  function toggleProjectTask(projectId, taskId) {
    const key = `${projectId}:${taskId}`
    setCollapsedProjectTasks((prev) => {
      const current = prev[key]
      return { ...prev, [key]: current === undefined ? false : !current }
    })
  }

  function openProjectTaskFromVisual(project, item) {
    const updates = {}
    let current = item
    const visited = new Set()

    while (current && !visited.has(current.id) && current.id !== project.id) {
      visited.add(current.id)
      const parentId = current.parent_work_item_id || project.id
      updates[`${parentId}:${current.id}`] = false
      current = workItemMap.get(parentId)
    }

    setCollapsedProjectTasks((prev) => ({ ...prev, ...updates }))
    setOpenProjectIds((prev) => prev.includes(project.id) ? prev : [...prev, project.id])
  }

  function isProjectTaskCollapsed(projectId, taskId, defaultCollapsed = true) {
    const value = collapsedProjectTasks[`${projectId}:${taskId}`]
    return value === undefined ? defaultCollapsed : !!value
  }

  function setProjectVisualMode(projectId, mode) {
    setProjectVisualModes((prev) => ({ ...prev, [projectId]: prev[projectId] === mode ? '' : mode }))
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
              {renderHighlightedText(fn.name || 'Sem nome', search)}
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
                      {renderHighlightedText(x.person?.name ?? 'Sem nome', search)}
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
      <div style={{ display: 'grid', gridTemplateColumns: '420px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <aside style={{ position: 'sticky', top: 16, alignSelf: 'start' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setOpenAreaIds(filteredAreas.map((x) => x.id))} style={{ padding:'6px 10px', ...pillStyle('ready') }}>+</button>
            <button onClick={() => setOpenAreaIds([])} style={{ padding:'6px 10px', ...pillStyle('waiting') }}>−</button>
          </div>

          <div style={{ ...cardStyle(), width: 420, minWidth: 420, maxWidth: 420, background:'#fff', border:'1px solid #b8c9b5' }}>
            {filteredAreas.length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {filteredAreas.map((area) => {
                  const stats = areaStats.get(area.id)
                  const isOpen = openAreaIds.includes(area.id)

                  return (
	                    <button
	                      key={area.id}
	                      style={{
	                        padding:'7px 10px',
	                        borderRadius:10,
	                        border:'1px solid #b8c9b5',
	                        background:isOpen ? '#dcefd8' : '#fff',
	                        color:'#16361f',
	                        textAlign:'left',
	                        cursor:'pointer',
	                        fontWeight:600,
	                        fontSize:13,
	                        minHeight:36
	                      }}
	                      onClick={() => setOpenAreaIds((prev) => prev.includes(area.id) ? prev.filter((x)=>x!==area.id) : [...prev, area.id])}
	                    >
	                      <span style={{ display:'flex', alignItems:'center', gap:8, lineHeight:1.2, minWidth:0 }}>
	                        <span style={{ minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
	                          {isOpen ? '− ' : '+ '}
	                          {renderHighlightedText(area.name || 'Sem nome', search)}
	                        </span>
	                        <span style={{ color:'#5f6f66', fontSize:11, fontWeight:500, whiteSpace:'nowrap', flexShrink:0 }}>
	                          {countLabel(stats?.functions ?? 0, 'função', 'funções')} · {countLabel(stats?.peopleIds.size ?? 0, 'pessoa', 'pessoas')}
	                        </span>
	                      </span>
	                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize:12, color:'#5f6f66', lineHeight:1.35 }}>
                Sem áreas para esta pesquisa.
              </div>
            )}
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
                        {renderHighlightedText(area.name || 'Sem nome', search)}
                      </div>

                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                        <span style={pillStyle('ready')}>{countLabel(areaStats.get(area.id)?.functions ?? 0, 'função', 'funções')}</span>
                        <span style={pillStyle('in_progress')}>{countLabel(areaStats.get(area.id)?.peopleIds.size ?? 0, 'pessoa', 'pessoas')}</span>
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
                                {renderHighlightedText(x.person?.name ?? 'Sem nome', search)}
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

                  {area.description ? <div style={{ fontSize:12, color:'#16361f', marginBottom:8 }}>{renderHighlightedText(area.description, search)}</div> : null}
                  {area.notes ? <div style={{ fontSize:12, color:'#4d5f55', marginBottom:8 }}>{renderHighlightedText(area.notes, search)}</div> : null}

                  {areaStats.get(area.id)?.functions ? renderFunctionList(area.id) : (
                    <div style={{ fontSize:12, color:'#5f6f66', border:'1px dashed #cfd9ca', borderRadius:10, padding:10 }}>
                      Sem funções registadas nesta área.
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  function renderProjectsView() {
    const openProjects = projectsData.filter((project) => openProjectIds.includes(project.id))

    function projectItemCounts(projectId) {
      const counts = { tasks: 0, subtasks: 0 }

      function walk(parentId) {
        for (const item of childrenByParent.get(parentId) ?? []) {
          if (item.type === 'task') counts.tasks += 1
          if (item.type === 'subtask') counts.subtasks += 1
          walk(item.id)
        }
      }

      walk(projectId)
      return counts
    }

    function renderProjectTree(parentId, depth = 0, visited = new Set(), prefix = '') {
      const items = childrenByParent.get(parentId) ?? []
      if (!items.length) return null

      return (
        <div style={{ display:'grid', gap:6 }}>
          {items.map((item, index) => {
            const hasCycle = visited.has(item.id)
            const nextVisited = new Set(visited)
            nextVisited.add(item.id)
            const itemNumber = prefix ? `${prefix}.${index + 1}` : `${index + 1}`
            const stateLabel = taskState(item, dependenciesBySuccessor, workItemMap)
            const stateKind =
              stateLabel === 'concluída'
                ? 'done'
                : stateLabel === 'em curso'
                  ? 'in_progress'
                  : stateLabel === 'BLOQUEADA'
                    ? 'waiting'
                    : 'ready'
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
                      <div style={{ fontSize:12.5, color:'#16361f', lineHeight:1.35, fontWeight:600, wordBreak:'break-word' }}>
                        {renderHighlightedText(workItemLine(item, itemNumber), search)}
                      </div>
                    </div>
                    <button
                      style={collapseIconButtonStyle()}
                      title={taskCollapsed ? 'Abrir' : 'Fechar'}
                      aria-label={taskCollapsed ? `Abrir ${item.name}` : `Fechar ${item.name}`}
                      onClick={() => toggleProjectTask(parentId, item.id)}
                    >
                      {taskCollapsed ? '⌄' : '^'}
                    </button>
                  </div>

                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start', marginTop:3 }}>
                    <div style={{ display:'grid', gap:2, minWidth:0 }}>
                      <span style={pillStyle(stateKind)}>
                        {stateLabel}
                      </span>

                      {item.description ? (
                        <div style={{ fontSize:11, color:'#5f6f66', lineHeight:1.35, wordBreak:'break-word' }}>
                          <strong>Notas:</strong> {renderHighlightedText(item.description, search)}
                        </div>
                      ) : null}
                    </div>
                  </div>

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

                {!hasCycle ? renderProjectTree(item.id, depth + 1, nextVisited, itemNumber) : null}
              </div>
            )
          })}
        </div>
      )
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '420px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <aside style={{ position: 'sticky', top: 16, alignSelf: 'start' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setOpenProjectIds(projectsData.map((x) => x.id))} style={{ padding:'6px 10px', ...pillStyle('ready') }}>+</button>
            <button onClick={() => setOpenProjectIds([])} style={{ padding:'6px 10px', ...pillStyle('waiting') }}>−</button>
          </div>

          <div style={{ ...cardStyle(), width: 420, minWidth: 420, maxWidth: 420, background:'#fff', border:'1px solid #b8c9b5' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              {projectsData.map((project) => {
                const counts = projectItemCounts(project.id)
                const isOpen = openProjectIds.includes(project.id)

                return (
                  <button
                    key={project.id}
                    style={{
                      padding:'7px 10px',
                      borderRadius:10,
                      border:'1px solid #b8c9b5',
                      background:isOpen ? '#dcefd8' : '#fff',
                      color:'#16361f',
                      textAlign:'left',
                      cursor:'pointer',
                      fontWeight:600,
                      fontSize:13,
                      minHeight:36
                    }}
                    onClick={() => setOpenProjectIds((prev) => prev.includes(project.id) ? prev.filter((x)=>x!==project.id) : [...prev, project.id])}
                  >
                    <span style={{ display:'flex', alignItems:'center', gap:8, lineHeight:1.2, minWidth:0 }}>
                      <span style={{ minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {isOpen ? '− ' : '+ '}
                        {renderHighlightedText(project.name, search)}
                      </span>
                      <span style={{ color:'#5f6f66', fontSize:11, fontWeight:500, whiteSpace:'nowrap', flexShrink:0 }}>
                        {countLabel(counts.tasks, 'tarefa', 'tarefas')} · {countLabel(counts.subtasks, 'subtarefa', 'subtarefas')}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        <div style={{ overflowX: 'auto', paddingBottom: 10 }}>
          {openProjects.length ? (
            <div style={{ display:'flex', gap:14, alignItems:'flex-start', width:'max-content' }}>
              {openProjects.map((project) => (
                <section
                  key={project.id}
                  style={{
                    ...cardStyle(),
                    flex: projectVisualModes[project.id] ? '0 0 min(1080px, calc(100vw - 470px))' : cardStyle().flex,
                    width: projectVisualModes[project.id] ? 'min(1080px, calc(100vw - 470px))' : cardStyle().width,
                    maxWidth: projectVisualModes[project.id] ? 'none' : cardStyle().maxWidth,
                    background:'#fff',
                    border:'1px solid #b8c9b5',
                  }}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start', marginBottom:10 }}>
                    <div style={{ fontSize:20, fontWeight:700, lineHeight:1.05, color:'#16361f' }}>{renderHighlightedText(project.name, search)}</div>
                    <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', justifyContent:'flex-end' }}>
                      <button
                        style={{ padding:'6px 10px', borderRadius:10, border:'1px solid #b8c9b5', background:projectVisualModes[project.id] === 'board' ? '#dcefd8' : '#fff', color:'#16361f', cursor:'pointer', fontSize:12 }}
                        onClick={() => setProjectVisualMode(project.id, 'board')}
                      >
                        Esquema
                      </button>
                      <button
                        style={{ padding:'6px 10px', borderRadius:10, border:'1px solid #b8c9b5', background:projectVisualModes[project.id] === 'gantt' ? '#dcefd8' : '#fff', color:'#16361f', cursor:'pointer', fontSize:12 }}
                        onClick={() => setProjectVisualMode(project.id, 'gantt')}
                      >
                        Gantt
                      </button>
                      <button
                        style={{ padding:'6px 10px', borderRadius:999, border:'1px solid #b8c9b5', background:'#fff', color:'#16361f', cursor:'pointer', fontSize:12 }}
                        onClick={() => setOpenProjectIds((prev) => prev.filter((x)=>x!==project.id))}
                      >
                        −
                      </button>
                    </div>
                  </div>

                  {project.description ? (
                    <div style={{ fontSize:12, color:'#35513c', marginBottom:12, lineHeight:1.4 }}>
                      {renderHighlightedText(project.description, search)}
                    </div>
                  ) : null}

                  {projectVisualModes[project.id] ? (
                    <div style={{ marginBottom: 12 }}>
                      <ProjectVisualView
                        project={workItemMap.get(project.id) ?? project}
                        workItems={workItems}
                        dependencies={workItemDependencies}
                        workItemPeople={workItemPeople}
                        mode={projectVisualModes[project.id]}
                        onModeChange={(mode) => setProjectVisualModes((prev) => ({ ...prev, [project.id]: mode }))}
                        onClose={() => setProjectVisualModes((prev) => ({ ...prev, [project.id]: '' }))}
                        onItemClick={(item) => openProjectTaskFromVisual(project, item)}
                        showModeButtons={false}
                        compact
                      />
                    </div>
                  ) : null}

                  <div style={{ border:'1px solid #cfd9ca', borderRadius:12, padding:12, background:'#fff', marginBottom:12 }}>
                    <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', textTransform:'uppercase', letterSpacing:0.3, marginBottom:6 }}>
                      Pendentes
                    </div>
                    <div style={{ fontSize:12, color:'#16361f', lineHeight:1.38, whiteSpace:'pre-line' }}>
                      {renderHighlightedText(project.pendingLabel, search)}
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
          ) : null}
        </div>
      </div>
    )
  }

  function renderPeopleView() {
    const openPeople = peopleData.filter((person) => openPersonIds.includes(person.id))
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '420px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <aside style={{ position: 'sticky', top: 16, alignSelf: 'start' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setOpenPersonIds(peopleData.map((x) => x.id))} style={{ padding:'6px 10px', ...pillStyle('ready') }}>+</button>
            <button onClick={() => setOpenPersonIds([])} style={{ padding:'6px 10px', ...pillStyle('waiting') }}>−</button>
          </div>
          <div style={{ ...cardStyle(), width: 420, minWidth: 420, maxWidth: 420 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              {peopleData.map((person) => (
                <button
                  key={person.id}
                  style={compactNavButtonStyle(openPersonIds.includes(person.id))}
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
                const searchSummary = personSearchSummary(person, search)
                const searchTargets = personSearchTargets(person, search)

                return (
                  <section key={person.id} style={{ ...cardStyle(), background:'#fff', border:'1px solid #b8c9b5' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:10 }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:20, fontWeight:700, lineHeight:1.05, color:'#16361f' }}>{renderHighlightedText(person.name, search)}</div>
                        {searchSummary ? (
                          <div style={{ marginTop:6, fontSize:11, color:'#35513c', lineHeight:1.35, background:'#eef6e8', border:'1px solid #cfe0c4', borderRadius:8, padding:'6px 8px' }}>
                            Correspondências nesta pessoa: {searchSummary.text}
                          </div>
                        ) : null}
                        {searchTargets.length ? (
                          <div style={{ marginTop:6, fontSize:11, color:'#35513c', lineHeight:1.35, background:'#fff', border:'1px solid #dfe7da', borderRadius:8, padding:'6px 8px' }}>
                            <div style={{ fontWeight:700, marginBottom:6 }}>Ir para correspondências</div>
                            <div style={{ display:'grid', gap:4 }}>
                              {searchTargets.map((target) => (
                                <button
                                  key={target.key}
                                  style={{ padding:0, border:'none', background:'transparent', color:'#2f5e3b', textAlign:'left', cursor:'pointer', fontSize:11 }}
                                  onClick={() => openPersonSearchTarget(person.id, target)}
                                >
                                  {target.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <button style={{ padding:'6px 10px', borderRadius:999, border:'1px solid #b8c9b5', background:'#fff', color:'#16361f', cursor:'pointer', fontSize:12 }} onClick={() => setOpenPersonIds((prev) => prev.filter((x)=>x!==person.id))}>−</button>
                    </div>

                    {person.areas.length ? (
                      <div style={{ border:'1px solid #cfd9ca', borderRadius:12, padding:'7px 10px', marginBottom:12, background:'#fff' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', minHeight:36, marginBottom:areasCollapsed ? 0 : 8 }}>
                          <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', textTransform:'uppercase', letterSpacing:0.3 }}>Responsável por áreas</div>
                          <button style={collapseIconButtonStyle()} title={areasCollapsed ? 'Mostrar' : 'Colapsar'} aria-label={areasCollapsed ? 'Mostrar áreas' : 'Colapsar áreas'} onClick={() => togglePersonSection(person.id, 'areas')}>
                            {areasCollapsed ? '⌄' : '^'}
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
                      <div style={{ border:'1px solid #cfd9ca', borderRadius:12, padding:'7px 10px', marginBottom:12, background:'#fff' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', minHeight:36, marginBottom:functionsCollapsed ? 0 : 8 }}>
                          <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', textTransform:'uppercase', letterSpacing:0.3 }}>Responsável por funções</div>
                          <button style={collapseIconButtonStyle()} title={functionsCollapsed ? 'Mostrar' : 'Colapsar'} aria-label={functionsCollapsed ? 'Mostrar funções' : 'Colapsar funções'} onClick={() => togglePersonSection(person.id, 'functions')}>
                            {functionsCollapsed ? '⌄' : '^'}
                          </button>
                        </div>
                        {!functionsCollapsed ? (
                          <div style={{ display:'grid', gap:4 }}>
                            {person.functions.map((item, i) => <div key={i} style={{ fontSize:12, color:'#16361f' }} ref={(el) => {
                              const key = `person-${person.id}-function-${i}`
                              if (el) peopleSearchTargetRefs.current.set(key, el)
                              else peopleSearchTargetRefs.current.delete(key)
                            }}>{renderHighlightedText(item, search)}</div>)}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {groupedProjects.length ? (
                      <div style={{ border:'1px solid #cfd9ca', borderRadius:12, padding:'7px 10px', background:'#fff' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', minHeight:36, marginBottom:projectsCollapsed ? 0 : 10 }}>
                          <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', textTransform:'uppercase', letterSpacing:0.3 }}>Projetos</div>
                          <button style={collapseIconButtonStyle()} title={projectsCollapsed ? 'Mostrar' : 'Colapsar'} aria-label={projectsCollapsed ? 'Mostrar projetos' : 'Colapsar projetos'} onClick={() => togglePersonSection(person.id, 'projects')}>
                            {projectsCollapsed ? '⌄' : '^'}
                          </button>
                        </div>

                        {!projectsCollapsed ? (
                          <div style={{ display:'grid', gap:10 }}>
                            {groupedProjects.map(([projectName, tasks]) => {
                              const collapsed = isPersonProjectCollapsed(person.id, projectName, true)
                              return (
	                                <div key={`${person.id}-${projectName}`} style={{ border:'1px solid #d9e3d3', borderRadius:12, background:'#fff', overflow:'hidden' }}>
	                                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', padding:'7px 10px', minHeight:36, background:'#f4f7f2' }}>
	                                    <div style={{ fontSize:12, fontWeight:800, color:'#16361f' }}>Projeto: {renderHighlightedText(projectName, search)}</div>
	                                    <button style={collapseIconButtonStyle()} title={collapsed ? 'Mostrar' : 'Colapsar'} aria-label={collapsed ? `Mostrar ${projectName}` : `Colapsar ${projectName}`} onClick={() => togglePersonProject(person.id, projectName)}>
	                                      {collapsed ? '⌄' : '^'}
	                                    </button>
	                                  </div>

                                  {!collapsed ? (
                                    <div style={{ display:'grid', gap:8, padding:12 }}>
                                      {tasks.map((task, taskIndex) => {
                                        const taskCollapsed = isPersonTaskCollapsed(person.id, task.id)
                                        return (
	                                          <div key={task.id} style={{ border:'1px solid #e1e9dc', borderRadius:10, padding:'7px 10px', background:'#fbfcfa', textAlign:'left' }}>
	                                            <div style={{ display:'grid', gap:6 }}>
	                                              <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start', minHeight:32 }}>
	                                                <div style={{ fontSize:13, lineHeight:1.35, color:'#16361f', fontWeight:600, minWidth:0 }}>
	                                                  {task.isProjectAssignment
	                                                    ? <>Projeto: {renderHighlightedText(task.projectName, search)}</>
	                                                    : renderHighlightedText(task.line ?? task.label, search)}
	                                                </div>
	                                                {!task.isProjectAssignment ? (
	                                                  <button style={collapseIconButtonStyle()} title={taskCollapsed ? 'Abrir' : 'Fechar'} aria-label={taskCollapsed ? `Abrir ${task.label}` : `Fechar ${task.label}`} onClick={() => togglePersonTask(person.id, task.id)}>
	                                                    {taskCollapsed ? '⌄' : '^'}
	                                                  </button>
	                                                ) : null}
	                                              </div>
	                                              {task.isProjectAssignment ? (
	                                                <div style={{ display:'grid', gap:3, fontSize:12, color:'#16361f', lineHeight:1.35 }}>
	                                                  {String(task.state ?? '').split('\n').filter(Boolean).map((line, lineIndex) => (
	                                                    <div key={lineIndex}>{renderHighlightedText(line, search)}</div>
	                                                  ))}
	                                                </div>
	                                              ) : (
	                                                <div>
	                                                  <span style={pillStyle(task.state === 'concluída' ? 'done' : task.state === 'em curso' ? 'in_progress' : task.state === 'BLOQUEADA' ? 'waiting' : 'ready')}>{task.state}</span>
	                                                </div>
	                                              )}
	                                            </div>

                                            {!task.isProjectAssignment && !taskCollapsed ? (
                                              <>
                                                {task.incoming?.length ? (
                                                  <div style={{ marginTop:8 }}>
                                                    <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', marginBottom:6, textTransform:'uppercase' }}>Tarefa bloqueada por:</div>
                                                    {task.incoming.map(({ dep, item }) => (
                                                      <div
                                                        key={dep.id}
                                                        style={{ fontSize:12, marginBottom:7, color:'#16361f', lineHeight:1.38, scrollMarginTop:80 }}
                                                        ref={(el) => {
                                                          const key = `person-${person.id}-incoming-${task.id}-${dep.id}`
                                                          if (el) peopleSearchTargetRefs.current.set(key, el)
                                                          else peopleSearchTargetRefs.current.delete(key)
                                                        }}
                                                      >
                                                        {renderHighlightedText(incomingDependencySummary(item?.name ?? 'Sem origem', dep.dependency_type), search)}
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : null}

                                                {task.outgoing?.length ? (
                                                  <div style={{ marginTop:8 }}>
                                                    <div style={{ fontSize:11, fontWeight:800, color:'#2f4b35', marginBottom:6, textTransform:'uppercase' }}>O que esta tarefa bloqueia:</div>
                                                    {task.outgoing.map(({ dep, item }) => (
                                                      <div
                                                        key={dep.id}
                                                        style={{ fontSize:12, marginBottom:7, color:'#16361f', lineHeight:1.38, scrollMarginTop:80 }}
                                                        ref={(el) => {
                                                          const key = `person-${person.id}-outgoing-${task.id}-${dep.id}`
                                                          if (el) peopleSearchTargetRefs.current.set(key, el)
                                                          else peopleSearchTargetRefs.current.delete(key)
                                                        }}
                                                      >
                                                        {renderHighlightedText(outgoingDependencySummary(item?.name ?? 'Sem destino', dep.dependency_type), search)}
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
          ) : null}
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

          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <button onClick={() => setActiveView('areas')} style={{ padding:'7px 12px', minHeight:36, borderRadius:999, border: activeView === 'areas' ? '1px solid #6e9575' : '1px solid #b8c9b5', background: activeView === 'areas' ? '#dcefd8' : '#fff', color:'#16361f', cursor:'pointer', fontSize:13, fontWeight:700 }}>ÁREAS</button>
            <button onClick={() => setActiveView('people')} style={{ padding:'7px 12px', minHeight:36, borderRadius:999, border: activeView === 'people' ? '1px solid #6e9575' : '1px solid #b8c9b5', background: activeView === 'people' ? '#dcefd8' : '#fff', color:'#16361f', cursor:'pointer', fontSize:13, fontWeight:700 }}>PESSOAS</button>
            <button onClick={() => setActiveView('projects')} style={{ padding:'7px 12px', minHeight:36, borderRadius:999, border: activeView === 'projects' ? '1px solid #6e9575' : '1px solid #b8c9b5', background: activeView === 'projects' ? '#dcefd8' : '#fff', color:'#16361f', cursor:'pointer', fontSize:13, fontWeight:700 }}>PROJETOS</button>
            <div style={{ position:'relative', width:330, maxWidth:'100%' }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisa por palavra-chave"
                style={{
                  padding: search ? '5px 36px 5px 10px' : '5px 10px',
                  minHeight:30,
                  width:'100%',
                  borderRadius:10,
                  border:'1px solid #b8c9b5',
                  background:'#fff',
                  color:'#16361f',
                  fontSize:12,
                  lineHeight:1.15,
                }}
              />
              {search ? (
                <button
                  type="button"
                  aria-label="Limpar pesquisa"
                  title="Limpar pesquisa"
                  onClick={() => setSearch('')}
                  style={{
                    position:'absolute',
                    right:6,
                    top:'50%',
                    transform:'translateY(-50%)',
                    width:24,
                    height:24,
                    border:'0',
                    background:'transparent',
                    color:'#46604d',
                    cursor:'pointer',
                    fontSize:18,
                    lineHeight:1,
                    padding:0,
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>

          {loading ? <div style={cardStyle()}>A carregar...</div> : null}
          {!loading && error ? <div style={{ ...cardStyle(), background:'#fff1f1', borderColor:'#d99c9c', color:'#7c1f1f' }}>{error}</div> : null}
          {!loading && !error ? (activeView === 'areas' ? renderAreasView() : activeView === 'people' ? renderPeopleView() : renderProjectsView()) : null}
        </div>
      </div>
    </>
  )
}

export default function App() {
  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  )
}
