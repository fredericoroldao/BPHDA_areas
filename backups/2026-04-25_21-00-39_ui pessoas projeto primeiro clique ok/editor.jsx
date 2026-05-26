import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase } from './supabaseClient'
import * as XLSX from 'xlsx'

const boxStyle = {
  background: '#ffffff',
  border: '1px solid #dfe7da',
  borderRadius: 12,
  padding: 14,
}

const subtleBoxStyle = {
  border: '1px solid #e3eadf',
  borderRadius: 10,
  padding: 10,
  background: '#fbfcfa',
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #cfd9ca',
  fontSize: 13,
  background: '#fff',
  textAlign: 'left',
}

const buttonStyle = {
  padding: '7px 11px',
  borderRadius: 999,
  border: '1px solid #cfd9ca',
  background: '#ffffff',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1.15,
}

const primaryButtonStyle = {
  ...buttonStyle,
  background: '#e8f2e0',
  border: '1px solid #b7cda8',
}

const dangerButtonStyle = {
  ...buttonStyle,
  background: '#fff4f4',
  border: '1px solid #efcaca',
  color: '#8a2f2f',
}

const tinyBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  height: 18,
  borderRadius: 999,
  border: '1px solid #b7cda8',
  background: '#eef6e8',
  color: '#35513c',
  fontSize: 11,
  fontWeight: 700,
  padding: '0 6px',
}

const calendarBadgeStyle = {
  ...tinyBadgeStyle,
  minWidth: 18,
  width: 'auto',
  height: 18,
  padding: '0 6px',
  fontSize: 11,
}

function CalendarTinyIcon() {
  return (
    <svg viewBox="0 0 256 256" width="11" height="11" aria-hidden="true">
      <path
        fill="currentColor"
        d="M208,36H180V24a4,4,0,0,0-8,0V36H84V24a4,4,0,0,0-8,0V36H48A12.01343,12.01343,0,0,0,36,48V208a12.01343,12.01343,0,0,0,12,12H208a12.01343,12.01343,0,0,0,12-12V48A12.01343,12.01343,0,0,0,208,36ZM48,44H76V56a4,4,0,0,0,8,0V44h88V56a4,4,0,0,0,8,0V44h28a4.00427,4.00427,0,0,1,4,4V84H44V48A4.00427,4.00427,0,0,1,48,44ZM208,212H48a4.00427,4.00427,0,0,1-4-4V92H212V208A4.00427,4.00427,0,0,1,208,212Z"
      />
    </svg>
  )
}

const areaRoleOptions = [
  ['lead', 'Responsável'],
  ['co_lead', 'Co-responsável'],
  ['support', 'Apoio'],
  ['informed', 'Informado'],
]

const genericRoleOptions = [
  ['owner', 'Responsável'],
  ['co_owner', 'Co-responsável'],
  ['assignee', 'Executante'],
  ['contributor', 'Contribui'],
  ['approver', 'Aprova'],
  ['reviewer', 'Revê'],
  ['informed', 'Informado'],
  ['watcher', 'Acompanha'],
]

const workItemTypeOptions = [
  ['project', 'Projeto'],
  ['task', 'Tarefa'],
  ['subtask', 'Subtarefa'],
  ['milestone', 'Marco'],
]

const workItemStatusOptions = [
  ['not_started', 'Não iniciado'],
  ['in_progress', 'Em curso'],
  ['blocked', 'Bloqueado'],
  ['done', 'Concluído'],
  ['cancelled', 'Cancelado'],
]

const phaseOptions = [
  ['planning', 'Planeamento'],
  ['execution', 'Execução'],
  ['review', 'Revisão'],
  ['completed', 'Concluído'],
]

const priorityOptions = [
  ['low', 'Baixa'],
  ['medium', 'Média'],
  ['high', 'Alta'],
  ['critical', 'Crítica'],
]

const dependencyTypeOptions = [
  ['finish_to_start', 'Só começa depois da anterior terminar'],
  ['start_to_start', 'Só começa quando a anterior começar'],
  ['finish_to_finish', 'Só termina depois da anterior terminar'],
  ['blocks', 'Bloqueia enquanto não estiver resolvida'],
  ['related_to', 'Relacionada'],
]

const DRAFT_WORK_ITEM_ID = '__draft_work_item__'

function emptyArea() {
  return { id: '', name: '', description: '', notes: '', status: 'active', sort_order: 0 }
}

function emptyFunction(areaId = '', parentId = '') {
  return {
    id: '',
    area_id: areaId,
    parent_function_id: parentId,
    name: '',
    description: '',
    notes: '',
    status: 'active',
    sort_order: 0,
  }
}

function emptyAreaAssignment(areaId = '') {
  return {
    id: '',
    area_id: areaId,
    person_id: '',
    assignment_role: 'lead',
    is_primary: true,
  }
}

function emptyFunctionAssignment(functionId = '') {
  return {
    id: '',
    function_id: functionId,
    person_id: '',
    assignment_role: 'owner',
    is_primary: true,
  }
}

function emptyPerson() {
  return { id: '', name: '', email: '', role_title: '', status: 'active' }
}

function emptyWorkItem(parentId = '', type = 'task') {
  return {
    id: '',
    parent_work_item_id: parentId,
    type,
    name: '',
    description: '',
    due_date: '',
    status: 'not_started',
    phase: 'planning',
    priority: 'medium',
    sort_order: 0,
  }
}

function emptyWorkItemAssignment(workItemId = '') {
  return {
    id: '',
    work_item_id: workItemId,
    person_id: '',
    assignment_role: 'owner',
    is_primary: true,
  }
}

function emptyDependency(currentWorkItemId = '', direction = 'incoming') {
  return {
    id: '',
    direction,
    predecessor_work_item_id: direction === 'outgoing' ? currentWorkItemId : '',
    successor_work_item_id: direction === 'incoming' ? currentWorkItemId : '',
    dependency_type: 'finish_to_start',
    lag_days: 0,
    note: '',
  }
}

function workItemTypeLabel(type) {
  return Object.fromEntries(workItemTypeOptions)[type] ?? type
}

function dependencySentence(predecessorName, successorName, type) {
  if (type === 'finish_to_start') return `[${successorName}] é bloqueada por [${predecessorName}] e só pode começar depois desta terminar`
  if (type === 'start_to_start') return `[${successorName}] depende de [${predecessorName}] e esta só pode começar quando a anterior começar`
  if (type === 'finish_to_finish') return `[${successorName}] depende de [${predecessorName}] e esta só pode terminar depois da anterior terminar`
  if (type === 'blocks') return `[${successorName}] é bloqueada por [${predecessorName}] enquanto esta não estiver resolvida`
  return `[${successorName}] está relacionada com [${predecessorName}]`
}

function outgoingDependencySentence(predecessorName, successorName, type) {
  if (type === 'finish_to_start') return `[${predecessorName}] bloqueia [${successorName}] e esta só pode começar depois da anterior terminar`
  if (type === 'start_to_start') return `[${predecessorName}] bloqueia [${successorName}] e esta só pode começar quando a anterior começar`
  if (type === 'finish_to_finish') return `[${predecessorName}] bloqueia [${successorName}] e esta só pode terminar depois da anterior terminar`
  if (type === 'blocks') return `[${predecessorName}] bloqueia [${successorName}] enquanto a anterior não estiver resolvida`
  return `[${predecessorName}] está relacionada com [${successorName}]`
}

function toggleInArray(prev, id) {
  return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
}

function findProject(workItem, workItemMap) {
  let current = workItem
  const visited = new Set()

  while (current) {
    if (visited.has(current.id)) return null
    visited.add(current.id)

    if (current.type === 'project') return current
    if (!current.parent_work_item_id) return null

    current = workItemMap.get(current.parent_work_item_id)
  }

  return null
}

function EditorApp() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('areas')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const [people, setPeople] = useState([])
  const [areas, setAreas] = useState([])
  const [functions, setFunctions] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [dependencies, setDependencies] = useState([])
  const [areaPeople, setAreaPeople] = useState([])
  const [functionPeople, setFunctionPeople] = useState([])
  const [workItemPeople, setWorkItemPeople] = useState([])

  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [selectedFunctionId, setSelectedFunctionId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedWorkItemId, setSelectedWorkItemId] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState('')

  const [areaForm, setAreaForm] = useState(null)
  const [functionForm, setFunctionForm] = useState(null)
  const [areaAssignmentForm, setAreaAssignmentForm] = useState(null)
  const [functionAssignmentForm, setFunctionAssignmentForm] = useState(null)
  const [workItemForm, setWorkItemForm] = useState(null)
  const [workItemAssignmentForm, setWorkItemAssignmentForm] = useState(null)
  const [dependencyForm, setDependencyForm] = useState(null)
  const [personForm, setPersonForm] = useState(null)

  const [pendingWorkItemAssignments, setPendingWorkItemAssignments] = useState([])
  const [pendingDependencies, setPendingDependencies] = useState([])

  const [openProjects, setOpenProjects] = useState([])
  const [collapsedPeopleSections, setCollapsedPeopleSections] = useState({})
  const [collapsedPeopleAreaCards, setCollapsedPeopleAreaCards] = useState({})

  const areaEditorRef = useRef(null)
  const projectEditorRef = useRef(null)
  const peopleEditorRef = useRef(null)

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if ((areaForm || functionForm || areaAssignmentForm || functionAssignmentForm) && areaEditorRef.current) {
      areaEditorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [areaForm, functionForm, areaAssignmentForm, functionAssignmentForm])

  useEffect(() => {
    if ((workItemForm || workItemAssignmentForm || dependencyForm) && projectEditorRef.current) {
      projectEditorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [workItemForm, workItemAssignmentForm, dependencyForm])

  useEffect(() => {
    if (personForm && peopleEditorRef.current) {
      peopleEditorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [personForm])

  useEffect(() => {
    if (!workItemForm) return
    if (!selectedProjectId) return
    const current = workItemForm.id ? (workItemMap.get(workItemForm.id) ?? workItemForm) : workItemForm
    const currentProject = current.type === 'project' ? current.id : (findProject(current, workItemMap)?.id ?? current.parent_work_item_id ?? '')
    if (currentProject && currentProject !== selectedProjectId) {
      setSelectedWorkItemId('')
      setWorkItemForm(null)
      setWorkItemAssignmentForm(null)
      setDependencyForm(null)
      clearPendingWorkItemDrafts()
    }
  }, [selectedProjectId])

  async function loadAll() {
    setLoading(true)
    setError('')
    setMessage('')

    const results = await Promise.all([
      supabase.from('people').select('*').order('name', { ascending: true }),
      supabase.from('areas').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('functions').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('work_items').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('work_item_dependencies').select('*'),
      supabase.from('area_people').select('*'),
      supabase.from('function_people').select('*'),
      supabase.from('work_item_people').select('*'),
    ])

    const firstError = results.find((r) => r.error)

    if (firstError?.error) {
      setError(firstError.error.message)
      setLoading(false)
      return
    }

    setPeople(results[0].data ?? [])
    setAreas(results[1].data ?? [])
    setFunctions(results[2].data ?? [])
    setWorkItems(results[3].data ?? [])
    setDependencies(results[4].data ?? [])
    setAreaPeople(results[5].data ?? [])
    setFunctionPeople(results[6].data ?? [])
    setWorkItemPeople(results[7].data ?? [])
    setLoading(false)
  }

  const peopleMap = useMemo(() => new Map(people.map((x) => [x.id, x])), [people])
  const workItemMap = useMemo(() => new Map(workItems.map((x) => [x.id, x])), [workItems])

  const activeWorkItemId = useMemo(
    () => {
      if (!workItemForm) return selectedWorkItemId
      return workItemForm.id || DRAFT_WORK_ITEM_ID
    },
    [workItemForm, selectedWorkItemId]
  )

  function personName(id) {
    return peopleMap.get(id)?.name ?? ''
  }

  function workItemLabel(item) {
    return `${workItemTypeLabel(item.type)}: ${item.name}`
  }

  const filteredAreas = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...areas]
    if (!q) return list
    return list.filter((a) => [a.name, a.description, a.notes].join(' ').toLowerCase().includes(q))
  }, [areas, query])

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...people]
    if (!q) return list
    return list.filter((p) => [p.name, p.email, p.role_title].join(' ').toLowerCase().includes(q))
  }, [people, query])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const results = []

    areas.forEach((area) => {
      ;[
        ['Nome da área', area.name],
        ['Notas da área', area.description],
        ['Notas da área', area.notes],
      ].forEach(([field, value]) => {
        if (String(value ?? '').toLowerCase().includes(q)) {
          results.push({
            key: `area-${area.id}-${field}`,
            kind: 'area',
            tab: 'areas',
            targetId: area.id,
            title: `Área: ${area.name}`,
            field,
            preview: matchPreview(value, q),
          })
        }
      })
    })

    functions.forEach((fn) => {
      const area = areas.find((a) => a.id === fn.area_id)
      ;[
        ['Nome da função', fn.name],
        ['Notas da função', fn.description],
        ['Notas da função', fn.notes],
        ['Área', area?.name],
      ].forEach(([field, value]) => {
        if (String(value ?? '').toLowerCase().includes(q)) {
          results.push({
            key: `function-${fn.id}-${field}`,
            kind: 'function',
            tab: 'areas',
            areaId: fn.area_id,
            targetId: fn.id,
            title: `Função: ${fn.name}`,
            field,
            preview: matchPreview(value, q),
          })
        }
      })
    })

    people.forEach((person) => {
      ;[
        ['Nome da pessoa', person.name],
        ['Email', person.email],
        ['Cargo / título', person.role_title],
      ].forEach(([field, value]) => {
        if (String(value ?? '').toLowerCase().includes(q)) {
          results.push({
            key: `person-${person.id}-${field}`,
            kind: 'person',
            tab: 'people',
            targetId: person.id,
            title: `Pessoa: ${person.name}`,
            field,
            preview: matchPreview(value, q),
          })
        }
      })
    })

    workItems.forEach((item) => {
      const project = findProject(item, workItemMap)
      ;[
        ['Nome do item', item.name],
        ['Notas do item', item.description],
        ['Prazo', item.due_date],
        ['Projeto', project?.name],
      ].forEach(([field, value]) => {
        if (String(value ?? '').toLowerCase().includes(q)) {
          results.push({
            key: `workitem-${item.id}-${field}`,
            kind: 'workItem',
            tab: 'projects',
            projectId: project?.id ?? (item.type === 'project' ? item.id : ''),
            targetId: item.id,
            title: `${workItemTypeLabel(item.type)}: ${item.name}`,
            field,
            preview: matchPreview(value, q),
          })
        }
      })
    })

    areaPeople.forEach((row) => {
      const aName = areaName(row.area_id)
      const pName = personName(row.person_id)
      if ([aName, pName, row.assignment_role].join(' ').toLowerCase().includes(q)) {
        results.push({
          key: `area-person-${row.id}`,
          kind: 'areaAssignment',
          tab: 'areas',
          targetId: row.area_id,
          title: `Responsável de área: ${aName}`,
          field: 'Responsável',
          preview: matchPreview(`${pName} ${row.assignment_role}`, q),
        })
      }
    })

    functionPeople.forEach((row) => {
      const fn = functions.find((x) => x.id === row.function_id)
      const aName = areaName(fn?.area_id)
      const fName = fn?.name ?? ''
      const pName = personName(row.person_id)
      if ([aName, fName, pName, row.assignment_role].join(' ').toLowerCase().includes(q)) {
        results.push({
          key: `function-person-${row.id}`,
          kind: 'functionAssignment',
          tab: 'areas',
          areaId: fn?.area_id ?? '',
          targetId: row.function_id,
          title: `Responsável de função: ${fName}`,
          field: 'Responsável',
          preview: matchPreview(`${aName} ${fName} ${pName} ${row.assignment_role}`, q),
        })
      }
    })

    workItemPeople.forEach((row) => {
      const item = workItems.find((x) => x.id === row.work_item_id)
      const project = item ? findProject(item, workItemMap) : null
      const pName = personName(row.person_id)
      if ([item?.name, project?.name, pName, row.assignment_role].join(' ').toLowerCase().includes(q)) {
        results.push({
          key: `workitem-person-${row.id}`,
          kind: 'workItemAssignment',
          tab: 'projects',
          projectId: project?.id ?? '',
          targetId: row.work_item_id,
          title: `Responsável de ${workItemTypeLabel(item?.type ?? '')}: ${item?.name ?? ''}`,
          field: 'Responsável',
          preview: matchPreview(`${project?.name ?? ''} ${item?.name ?? ''} ${pName} ${row.assignment_role}`, q),
        })
      }
    })

    return results.slice(0, 80)
  }, [query, areas, functions, people, workItems, areaPeople, functionPeople, workItemPeople, workItemMap])

  function openSearchResult(result) {
    if (result.tab === 'areas') {
      setTab('areas')
      if (result.areaId) setSelectedAreaId(result.areaId)
      if (result.kind === 'area') {
        const area = areas.find((x) => x.id === result.targetId)
        if (area) {
          setSelectedAreaId(area.id)
          setAreaForm({ ...area })
        }
      }
      if (result.kind === 'function' || result.kind === 'functionAssignment') {
        const fn = functions.find((x) => x.id === result.targetId)
        if (fn) {
          setSelectedAreaId(fn.area_id)
          setSelectedFunctionId(fn.id)
          setFunctionForm({ ...fn })
        }
      }
      return
    }

    if (result.tab === 'projects') {
      setTab('projects')
      if (result.projectId) {
        setSelectedProjectId(result.projectId)
        setOpenProjects((prev) => prev.includes(result.projectId) ? prev : [...prev, result.projectId])
      }
      const item = workItems.find((x) => x.id === result.targetId)
      if (item) {
        setSelectedWorkItemId(item.id)
        clearPendingWorkItemDrafts()
        setWorkItemForm({ ...item })
      }
      return
    }

    if (result.tab === 'people') {
      setTab('people')
      const person = people.find((x) => x.id === result.targetId)
      if (person) {
        setSelectedPersonId(person.id)
        setPersonForm({ ...person })
      }
    }
  }

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = workItems.filter((x) => x.type === 'project')
    if (!q) return list
    return list.filter((x) => [x.name, x.description].join(' ').toLowerCase().includes(q))
  }, [workItems, query])

  const areaFunctions = useMemo(
    () => functions.filter((f) => f.area_id === selectedAreaId),
    [functions, selectedAreaId]
  )

  const areaAssignments = useMemo(
    () => areaPeople.filter((x) => x.area_id === selectedAreaId),
    [areaPeople, selectedAreaId]
  )

  const functionAssignments = useMemo(
    () => functionPeople.filter((x) => x.function_id === selectedFunctionId),
    [functionPeople, selectedFunctionId]
  )

  const projectTasksMap = useMemo(() => {
    const byParent = new Map()

    for (const item of workItems) {
      const key = item.parent_work_item_id ?? '__root__'
      if (!byParent.has(key)) byParent.set(key, [])
      byParent.get(key).push(item)
    }

    for (const arr of byParent.values()) {
      arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'pt'))
    }

    const result = new Map()

    function collectForProject(projectId) {
      const rows = []

      function walk(parentId, depth = 0) {
        const children = byParent.get(parentId ?? '__root__') ?? []
        for (const child of children) {
          rows.push({ ...child, depth })
          walk(child.id, depth + 1)
        }
      }

      walk(projectId, 0)
      result.set(projectId, rows)
    }

    for (const item of workItems) {
      if (item.type === 'project') collectForProject(item.id)
    }

    return result
  }, [workItems])

  const selectedProjectTasks = useMemo(() => {
    return selectedProjectId ? (projectTasksMap.get(selectedProjectId) ?? []) : []
  }, [selectedProjectId, projectTasksMap])

  const selectedWorkItemAssignments = useMemo(
    () => workItemPeople.filter((x) => x.work_item_id === activeWorkItemId),
    [workItemPeople, activeWorkItemId]
  )

  const displayedWorkItemAssignments = useMemo(
    () => (workItemForm?.id ? selectedWorkItemAssignments : pendingWorkItemAssignments),
    [workItemForm, selectedWorkItemAssignments, pendingWorkItemAssignments]
  )

  const incomingDeps = useMemo(
    () => dependencies.filter((x) => x.successor_work_item_id === activeWorkItemId),
    [dependencies, activeWorkItemId]
  )

  const outgoingDeps = useMemo(
    () => dependencies.filter((x) => x.predecessor_work_item_id === activeWorkItemId),
    [dependencies, activeWorkItemId]
  )

  const displayedIncomingDeps = useMemo(
    () => (workItemForm?.id ? incomingDeps : pendingDependencies.filter((x) => x.direction === 'incoming' || x.successor_work_item_id === DRAFT_WORK_ITEM_ID)),
    [workItemForm, incomingDeps, pendingDependencies]
  )

  const displayedOutgoingDeps = useMemo(
    () => (workItemForm?.id ? outgoingDeps : pendingDependencies.filter((x) => x.direction === 'outgoing' || x.predecessor_work_item_id === DRAFT_WORK_ITEM_ID)),
    [workItemForm, outgoingDeps, pendingDependencies]
  )

  const selectedWorkItemProjectId = useMemo(() => {
    const item = workItemMap.get(selectedWorkItemId)
    return item ? findProject(item, workItemMap)?.id ?? '' : ''
  }, [selectedWorkItemId, workItemMap])

  const editorWorkItemProjectId = useMemo(() => {
    if (!workItemForm) return ''
    if (workItemForm.id) {
      const item = workItemMap.get(workItemForm.id) ?? workItemForm
      return findProject(item, workItemMap)?.id ?? ''
    }
    if (workItemForm.type === 'project') return ''
    if (!workItemForm.parent_work_item_id) return selectedProjectId || ''
    const parent = workItemMap.get(workItemForm.parent_work_item_id)
    if (!parent) return selectedProjectId || ''
    if (parent.type === 'project') return parent.id
    return findProject(parent, workItemMap)?.id ?? selectedProjectId ?? ''
  }, [workItemForm, workItemMap, selectedProjectId])

  const currentProjectTaskOptions = useMemo(() => {
    if (!editorWorkItemProjectId) return []
    return workItems.filter((item) => {
      const project = findProject(item, workItemMap)
      return project?.id === editorWorkItemProjectId && item.type !== 'project'
    })
  }, [workItems, editorWorkItemProjectId, workItemMap])

  const otherProjectTaskOptions = useMemo(() => {
    const currentId = workItemForm?.id || DRAFT_WORK_ITEM_ID
    return currentProjectTaskOptions.filter((item) => item.id !== currentId)
  }, [currentProjectTaskOptions, workItemForm])

  const dependencyEditorMode = useMemo(() => {
    if (!dependencyForm) return ''
    if (dependencyForm.direction === 'incoming' || dependencyForm.direction === 'outgoing') {
      return dependencyForm.direction
    }

    const currentId = workItemForm?.id || DRAFT_WORK_ITEM_ID

    if (dependencyForm.predecessor_work_item_id === currentId) return 'outgoing'
    if (dependencyForm.successor_work_item_id === currentId) return 'incoming'

    if (dependencyForm.predecessor_work_item_id && !dependencyForm.successor_work_item_id) return 'outgoing'
    if (!dependencyForm.predecessor_work_item_id && dependencyForm.successor_work_item_id) return 'incoming'

    return ''
  }, [dependencyForm, workItemForm])

  function clearSearch() {
    setQuery('')
  }

  function areaName(areaId) {
    return areas.find((x) => x.id === areaId)?.name ?? ''
  }

  function functionName(functionId) {
    return functions.find((x) => x.id === functionId)?.name ?? ''
  }

  function workItemName(workItemId) {
    const item = workItems.find((x) => x.id === workItemId)
    return item ? workItemLabel(item) : ''
  }

  function matchPreview(value, queryValue) {
    const source = String(value ?? '')
    const q = String(queryValue ?? '').trim().toLowerCase()
    if (!q || !source) return ''
    const lower = source.toLowerCase()
    const idx = lower.indexOf(q)
    if (idx === -1) return ''
    const start = Math.max(0, idx - 28)
    const end = Math.min(source.length, idx + q.length + 28)
    return source.slice(start, end)
  }

  function clearPendingWorkItemDrafts() {
    setPendingWorkItemAssignments([])
    setPendingDependencies([])
    setWorkItemAssignmentForm(null)
    setDependencyForm(null)
  }

  async function saveForm(table, form, payload, msg) {
    setSaving(true)
    setError('')
    setMessage('')

    const res = form.id
      ? await supabase.from(table).update(payload).eq('id', form.id)
      : await supabase.from(table).insert(payload)

    setSaving(false)

    if (res.error) {
      setError(res.error.message)
      return false
    }

    setMessage(msg)
    await loadAll()
    return true
  }

  function deleteLabel(table, id) {
    if (table === 'areas') return areas.find((x) => x.id === id)?.name ?? 'Área'
    if (table === 'functions') return `Função: ${functions.find((x) => x.id === id)?.name ?? 'Função'}`
    if (table === 'work_items') {
      const item = workItems.find((x) => x.id === id)
      if (item) return workItemLabel(item)
      if (workItemForm?.id === id) return workItemLabel(workItemForm)
      return 'Projeto / tarefa'
    }
    if (table === 'people') {
      const item = people.find((x) => x.id === id)
      if (item) return item.name
      if (personForm?.id === id) return personForm.name || 'Pessoa'
      return 'Pessoa'
    }
    if (table === 'area_people') {
      const row = areaPeople.find((x) => x.id === id)
      return row ? `${areas.find((a) => a.id === row.area_id)?.name ?? 'Área'} → ${personName(row.person_id)}` : 'Responsável de área'
    }
    if (table === 'function_people') {
      const row = functionPeople.find((x) => x.id === id)
      const fn = functions.find((x) => x.id === row?.function_id)
      return row ? `${fn?.name ?? 'Função'} → ${personName(row.person_id)}` : 'Responsável de função'
    }
    if (table === 'work_item_people') {
      const row = workItemPeople.find((x) => x.id === id)
      const wi = workItems.find((x) => x.id === row?.work_item_id)
      return row ? `${wi ? workItemLabel(wi) : 'Projeto / tarefa'} → ${personName(row.person_id)}` : 'Responsável'
    }
    if (table === 'work_item_dependencies') {
      const row = dependencies.find((x) => x.id === id)
      const pred = workItems.find((x) => x.id === row?.predecessor_work_item_id)
      const succ = workItems.find((x) => x.id === row?.successor_work_item_id)
      return row ? `${pred?.name ?? 'Sem origem'} → ${succ?.name ?? 'Sem destino'}` : 'Dependência'
    }
    return id
  }

  function clearSelectionAfterDelete(table, id) {
    if (table === 'areas') {
      if (selectedAreaId === id) setSelectedAreaId('')
      if (areaForm?.id === id) setAreaForm(null)
      if (functionForm?.area_id === id) setFunctionForm(null)
      if (areaAssignmentForm?.area_id === id) setAreaAssignmentForm(null)
    }

    if (table === 'functions') {
      if (selectedFunctionId === id) setSelectedFunctionId('')
      if (functionForm?.id === id) setFunctionForm(null)
      if (functionAssignmentForm?.function_id === id) setFunctionAssignmentForm(null)
    }

    if (table === 'work_items') {
      if (selectedWorkItemId === id) setSelectedWorkItemId('')
      if (selectedProjectId === id) {
        setSelectedProjectId('')
        setOpenProjects((prev) => prev.filter((x) => x !== id))
      }
      if (workItemForm?.id === id) setWorkItemForm(null)
      if (workItemAssignmentForm?.work_item_id === id) setWorkItemAssignmentForm(null)
      if (dependencyForm?.predecessor_work_item_id === id || dependencyForm?.successor_work_item_id === id) {
        setDependencyForm(null)
      }
    }

    if (table === 'people') {
      if (selectedPersonId === id) setSelectedPersonId('')
      if (personForm?.id === id) setPersonForm(null)
    }

    if (table === 'area_people' && areaAssignmentForm?.id === id) setAreaAssignmentForm(null)
    if (table === 'function_people' && functionAssignmentForm?.id === id) setFunctionAssignmentForm(null)
    if (table === 'work_item_people' && workItemAssignmentForm?.id === id) setWorkItemAssignmentForm(null)
    if (table === 'work_item_dependencies' && dependencyForm?.id === id) setDependencyForm(null)
  }

  async function removeRow(table, id) {
    const label = deleteLabel(table, id)

    if (!window.confirm(`Tens a certeza que queres apagar “${label}”?`)) return

    setSaving(true)
    setError('')
    setMessage('')

    const res = await supabase.from(table).delete().eq('id', id)

    setSaving(false)

    if (res.error) {
      setError(res.error.message)
      return
    }

    clearSelectionAfterDelete(table, id)
    setMessage('Registo apagado com sucesso.')
    await loadAll()
  }

  async function saveArea() {
    if (!areaForm?.name?.trim()) {
      setError('O nome da área é obrigatório.')
      return
    }

    const ok = await saveForm(
      'areas',
      areaForm,
      {
        name: areaForm.name,
        description: areaForm.description || null,
        notes: areaForm.notes || null,
        status: areaForm.status,
        sort_order: areaForm.id ? areaForm.sort_order ?? 0 : (areas.at(-1)?.sort_order ?? 0) + 1,
      },
      'Área gravada com sucesso.'
    )

    if (ok) setAreaForm(null)
  }

  async function saveFunction() {
    if (!functionForm?.area_id) {
      setError('Escolhe uma área.')
      return
    }

    if (!functionForm?.name?.trim()) {
      setError('O nome da função é obrigatório.')
      return
    }

    const siblings = functions.filter(
      (x) =>
        x.area_id === functionForm.area_id &&
        (x.parent_function_id ?? '') === (functionForm.parent_function_id ?? '') &&
        x.id !== functionForm.id
    )

    const ok = await saveForm(
      'functions',
      functionForm,
      {
        area_id: functionForm.area_id,
        parent_function_id: functionForm.parent_function_id || null,
        name: functionForm.name,
        description: functionForm.description || null,
        notes: functionForm.notes || null,
        status: functionForm.status,
        level: functionForm.parent_function_id ? 2 : 1,
        sort_order: functionForm.id
          ? functionForm.sort_order ?? 0
          : (siblings.length ? Math.max(...siblings.map((x) => x.sort_order ?? 0)) : 0) + 1,
      },
      'Função gravada com sucesso.'
    )

    if (ok) setFunctionForm(null)
  }

  async function saveAreaAssignment() {
    if (!areaAssignmentForm?.area_id || !areaAssignmentForm?.person_id) {
      setError('Escolhe área e pessoa.')
      return
    }

    const ok = await saveForm(
      'area_people',
      areaAssignmentForm,
      {
        area_id: areaAssignmentForm.area_id,
        person_id: areaAssignmentForm.person_id,
        assignment_role: areaAssignmentForm.assignment_role,
        is_primary: areaAssignmentForm.is_primary,
      },
      'Responsável da área gravado com sucesso.'
    )

    if (ok) setAreaAssignmentForm(null)
  }

  async function saveFunctionAssignment() {
    if (!functionAssignmentForm?.function_id || !functionAssignmentForm?.person_id) {
      setError('Escolhe função e pessoa.')
      return
    }

    const ok = await saveForm(
      'function_people',
      functionAssignmentForm,
      {
        function_id: functionAssignmentForm.function_id,
        person_id: functionAssignmentForm.person_id,
        assignment_role: functionAssignmentForm.assignment_role,
        is_primary: functionAssignmentForm.is_primary,
      },
      'Responsável da função gravado com sucesso.'
    )

    if (ok) setFunctionAssignmentForm(null)
  }

  async function saveWorkItem() {
    if (!workItemForm?.name?.trim()) {
      setError('O nome é obrigatório.')
      return
    }

    const siblings = workItems.filter(
      (x) => (x.parent_work_item_id ?? '') === (workItemForm.parent_work_item_id ?? '') && x.id !== workItemForm.id
    )

    if (workItemForm.id) {
      const ok = await saveForm(
        'work_items',
        workItemForm,
        {
          parent_work_item_id: workItemForm.parent_work_item_id || null,
          type: workItemForm.type,
          name: workItemForm.name,
          description: workItemForm.description || null,
          due_date: workItemForm.due_date || null,
          status: workItemForm.status,
          phase: workItemForm.phase,
          priority: workItemForm.priority,
          sort_order: workItemForm.sort_order ?? 0,
        },
        'Projeto / tarefa gravado com sucesso.'
      )

      if (ok) {
        setWorkItemForm(null)
        setWorkItemAssignmentForm(null)
        setDependencyForm(null)
      }
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const createRes = await supabase
      .from('work_items')
      .insert({
        parent_work_item_id: workItemForm.parent_work_item_id || null,
        type: workItemForm.type,
        name: workItemForm.name,
        description: workItemForm.description || null,
        due_date: workItemForm.due_date || null,
        status: workItemForm.status,
        phase: workItemForm.phase,
        priority: workItemForm.priority,
        sort_order: (siblings.length ? Math.max(...siblings.map((x) => x.sort_order ?? 0)) : 0) + 1,
      })
      .select()
      .single()

    if (createRes.error || !createRes.data) {
      setSaving(false)
      setError(createRes.error?.message || 'Erro ao criar item')
      return
    }

    const created = createRes.data
    const workItemId = created.id

    for (const row of pendingWorkItemAssignments) {
      const res = await supabase.from('work_item_people').insert({
        work_item_id: workItemId,
        person_id: row.person_id,
        assignment_role: row.assignment_role,
        is_primary: row.is_primary,
      })
      if (res.error) {
        setSaving(false)
        setError(res.error.message)
        return
      }
    }

    for (const dep of pendingDependencies) {
      const predecessor = !dep.predecessor_work_item_id || dep.predecessor_work_item_id === DRAFT_WORK_ITEM_ID
        ? workItemId
        : dep.predecessor_work_item_id
      const successor = !dep.successor_work_item_id || dep.successor_work_item_id === DRAFT_WORK_ITEM_ID
        ? workItemId
        : dep.successor_work_item_id

      const res = await supabase.from('work_item_dependencies').insert({
        predecessor_work_item_id: predecessor,
        successor_work_item_id: successor,
        dependency_type: dep.dependency_type,
        lag_days: Number(dep.lag_days) || 0,
        note: dep.note || null,
      })
      if (res.error) {
        setSaving(false)
        setError(res.error.message)
        return
      }
    }

    setSaving(false)
    clearPendingWorkItemDrafts()
    setWorkItemForm(null)
    setMessage('Projeto / tarefa gravado com sucesso.')
    await loadAll()
  }

  async function saveWorkItemAssignment() {
    if (!workItemAssignmentForm?.work_item_id || !workItemAssignmentForm?.person_id) {
      setError('Escolhe projeto/tarefa e pessoa.')
      return
    }

    const ok = await saveForm(
      'work_item_people',
      workItemAssignmentForm,
      {
        work_item_id: workItemAssignmentForm.work_item_id,
        person_id: workItemAssignmentForm.person_id,
        assignment_role: workItemAssignmentForm.assignment_role,
        is_primary: workItemAssignmentForm.is_primary,
      },
      'Responsável gravado com sucesso.'
    )

    if (ok) {
      setWorkItemAssignmentForm(null)
    }
  }

  async function saveDependency() {
    if (!dependencyForm?.predecessor_work_item_id || !dependencyForm?.successor_work_item_id) {
      setError('Escolhe tarefa origem e tarefa destino.')
      return
    }

    if (dependencyForm.predecessor_work_item_id === dependencyForm.successor_work_item_id) {
      setError('Origem e destino não podem ser a mesma tarefa.')
      return
    }

    const ok = await saveForm(
      'work_item_dependencies',
      dependencyForm,
      {
        predecessor_work_item_id: dependencyForm.predecessor_work_item_id,
        successor_work_item_id: dependencyForm.successor_work_item_id,
        dependency_type: dependencyForm.dependency_type,
        lag_days: Number(dependencyForm.lag_days) || 0,
        note: dependencyForm.note || null,
      },
      'Dependência gravada com sucesso.'
    )

    if (ok) {
      setDependencyForm(null)
    }
  }

  async function savePerson() {
    if (!personForm?.name?.trim()) {
      setError('O nome é obrigatório.')
      return
    }

    const ok = await saveForm(
      'people',
      personForm,
      {
        name: personForm.name,
        email: personForm.email || null,
        role_title: personForm.role_title || null,
        status: personForm.status,
      },
      'Pessoa gravada com sucesso.'
    )

    if (ok) setPersonForm(null)
  }

  function personOperationalData(personId) {
    const areasMap = new Map()

    function ensureArea(areaId, areaName) {
      const key = areaId || `no-area:${areaName || 'Sem área'}`
      if (!areasMap.has(key)) {
        areasMap.set(key, {
          key,
          areaId: areaId || '',
          areaName: areaName || 'Sem área',
          areaAssignments: [],
          functionAssignments: [],
        })
      }
      return areasMap.get(key)
    }

    areaPeople
      .filter((row) => row.person_id === personId)
      .forEach((row) => {
        const bucket = ensureArea(row.area_id, areaName(row.area_id))
        bucket.areaAssignments.push({
          id: row.id,
          role: row.assignment_role,
          isPrimary: !!row.is_primary,
        })
      })

    functionPeople
      .filter((row) => row.person_id === personId)
      .forEach((row) => {
        const fn = functions.find((x) => x.id === row.function_id)
        const bucket = ensureArea(fn?.area_id ?? '', areaName(fn?.area_id))
        bucket.functionAssignments.push({
          id: row.id,
          functionName: fn?.name ?? '',
          role: row.assignment_role,
          isPrimary: !!row.is_primary,
        })
      })

    const areaCards = Array.from(areasMap.values()).sort((a, b) => a.areaName.localeCompare(b.areaName, 'pt'))

    const involvedItems = workItemPeople
      .filter((row) => row.person_id === personId)
      .map((row) => {
        const item = workItems.find((x) => x.id === row.work_item_id)
        const project = item ? findProject(item, workItemMap) : null
        return {
          id: row.id,
          projectName: project?.name ?? '',
          workItemType: item?.type ?? '',
          workItemName: item?.name ?? '',
          role: row.assignment_role,
          isPrimary: !!row.is_primary,
        }
      })

    return { areaCards, involvedItems }
  }

  function exportToExcel() {
    const workbook = XLSX.utils.book_new()

    const areasSheet = areas.map((row) => ({
      ID: row.id,
      Nome: row.name,
      Descrição: row.description ?? '',
      Notas: row.notes ?? '',
      Estado: row.status ?? '',
      Ordem: row.sort_order ?? '',
    }))

    const functionsSheet = functions.map((row) => ({
      ID: row.id,
      Área: areaName(row.area_id),
      Função_mãe: functionName(row.parent_function_id),
      Nome: row.name,
      Descrição: row.description ?? '',
      Notas: row.notes ?? '',
      Estado: row.status ?? '',
      Ordem: row.sort_order ?? '',
    }))

    const peopleSheet = people.map((row) => ({
      ID: row.id,
      Nome: row.name,
      Email: row.email ?? '',
      Cargo: row.role_title ?? '',
      Estado: row.status ?? '',
    }))

    const workItemsSheet = workItems.map((row) => {
      const parent = workItems.find((x) => x.id === row.parent_work_item_id)
      const project = findProject(row, workItemMap)
      return {
        ID: row.id,
        Projeto: project?.name ?? (row.type === 'project' ? row.name : ''),
        Tipo: workItemTypeLabel(row.type),
        Nome: row.name,
        Item_pai: parent ? workItemLabel(parent) : '',
        Descrição: row.description ?? '',
        Prazo: row.due_date ?? '',
        Estado: row.status ?? '',
        Fase: row.phase ?? '',
        Prioridade: row.priority ?? '',
        Ordem: row.sort_order ?? '',
      }
    })

    const dependenciesSheet = dependencies.map((row) => ({
      ID: row.id,
      Origem: workItemName(row.predecessor_work_item_id),
      Destino: workItemName(row.successor_work_item_id),
      Tipo: row.dependency_type ?? '',
      Lag_dias: row.lag_days ?? 0,
      Nota: row.note ?? '',
    }))

    const areaRespSheet = areaPeople.map((row) => ({
      ID: row.id,
      Área: areaName(row.area_id),
      Pessoa: personName(row.person_id),
      Papel: row.assignment_role,
      Principal: row.is_primary ? 'Sim' : 'Não',
    }))

    const functionRespSheet = functionPeople.map((row) => {
      const fn = functions.find((x) => x.id === row.function_id)
      return {
        ID: row.id,
        Área: areaName(fn?.area_id),
        Função: fn?.name ?? '',
        Pessoa: personName(row.person_id),
        Papel: row.assignment_role,
        Principal: row.is_primary ? 'Sim' : 'Não',
      }
    })

    const workItemRespSheet = workItemPeople.map((row) => {
      const item = workItems.find((x) => x.id === row.work_item_id)
      const project = item ? findProject(item, workItemMap) : null
      return {
        ID: row.id,
        Projeto: project?.name ?? '',
        Item: item ? workItemLabel(item) : '',
        Pessoa: personName(row.person_id),
        Papel: row.assignment_role,
        Principal: row.is_primary ? 'Sim' : 'Não',
      }
    })

    const personSummarySheet = people.flatMap((person) => {
      const data = personOperationalData(person.id)
      const rows = []

      const hasAreaAssignments = (data.areaCards ?? []).some((card) => (card.areaAssignments ?? []).length)
      const hasFunctionAssignments = (data.areaCards ?? []).some((card) => (card.functionAssignments ?? []).length)
      const hasInvolvedItems = (data.involvedItems ?? []).length > 0

      if (!hasAreaAssignments && !hasFunctionAssignments && !hasInvolvedItems) {
        rows.push({
          Pessoa: person.name,
          Tipo: 'Sem dados',
          Contexto_1: '',
          Contexto_2: '',
          Papel: '',
          Principal: '',
        })
      }

      ;(data.areaCards ?? []).forEach((card) => {
        ;(card.areaAssignments ?? []).forEach((row) => {
          rows.push({
            Pessoa: person.name,
            Tipo: 'Área',
            Contexto_1: card.areaName,
            Contexto_2: '',
            Papel: row.role,
            Principal: row.isPrimary ? 'Sim' : 'Não',
          })
        })

        ;(card.functionAssignments ?? []).forEach((row) => {
          rows.push({
            Pessoa: person.name,
            Tipo: 'Função',
            Contexto_1: card.areaName,
            Contexto_2: row.functionName,
            Papel: row.role,
            Principal: row.isPrimary ? 'Sim' : 'Não',
          })
        })
      })

      ;(data.involvedItems ?? []).forEach((row) => {
        rows.push({
          Pessoa: person.name,
          Tipo: 'Projeto/Tarefa',
          Contexto_1: row.projectName,
          Contexto_2: `${workItemTypeLabel(row.workItemType)}: ${row.workItemName}`,
          Papel: row.role,
          Principal: row.isPrimary ? 'Sim' : 'Não',
        })
      })

      return rows
    })

    const sheets = [
      ['Áreas', areasSheet],
      ['Funções', functionsSheet],
      ['Pessoas', peopleSheet],
      ['Projetos_Tarefas', workItemsSheet],
      ['Dependências', dependenciesSheet],
      ['Resp_Áreas', areaRespSheet],
      ['Resp_Funções', functionRespSheet],
      ['Resp_Projetos_Tarefas', workItemRespSheet],
      ['Resumo_Por_Pessoa', personSummarySheet],
    ]

    sheets.forEach(([name, rows]) => {
      const worksheet = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(workbook, worksheet, name)
    })

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    XLSX.writeFile(workbook, `brainstorm_editor_export_${stamp}.xlsx`)
  }

  async function moveItem(table, list, id, dir) {
    const index = list.findIndex((x) => x.id === id)
    const target = dir === 'up' ? index - 1 : index + 1
    if (index < 0 || target < 0 || target >= list.length) return

    const reordered = [...list]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)

    setSaving(true)
    setError('')

    const results = await Promise.all(
      reordered.map((item, idx) => supabase.from(table).update({ sort_order: idx + 1 }).eq('id', item.id))
    )

    setSaving(false)

    const failed = results.find((res) => res.error)
    if (failed?.error) {
      setError(failed.error.message || 'Erro ao ordenar')
      return
    }

    await loadAll()
  }

  const visibleAreaFunctions = useMemo(() => {
    const byParent = new Map()

    for (const fn of areaFunctions) {
      const key = fn.parent_function_id ?? '__root__'
      if (!byParent.has(key)) byParent.set(key, [])
      byParent.get(key).push(fn)
    }

    for (const arr of byParent.values()) {
      arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'pt'))
    }

    return byParent
  }, [areaFunctions])

  function functionHasResponsible(functionId) {
    return functionPeople.some((row) => row.function_id === functionId)
  }

  function workItemHasResponsible(workItemId) {
    return workItemPeople.some((row) => row.work_item_id === workItemId)
  }

  function workItemHasDependency(workItemId) {
    return dependencies.some(
      (row) => row.predecessor_work_item_id === workItemId || row.successor_work_item_id === workItemId
    )
  }

  function workItemHasDueDate(workItemId) {
    const item = workItems.find((row) => row.id === workItemId)
    return !!item?.due_date
  }

  function canCreateSubtask(item) {
    if (!item) return false
    if (item.type === 'project') return false
    return selectedWorkItemId === item.id
  }

  function renderFunctionTree(parentId = '', depth = 0) {
    const items = visibleAreaFunctions.get(parentId || '__root__') ?? []

    return (
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map((fn) => {
          const siblings = items

          return (
            <div key={fn.id}>
              <div style={{ display: 'flex', gap: 6, marginLeft: depth * 16 }}>
                <button
                  style={{ ...(selectedFunctionId === fn.id ? primaryButtonStyle : buttonStyle), flex: 1, textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => {
                    setSelectedFunctionId(fn.id)
                    setSelectedAreaId(fn.area_id)
                    setFunctionForm({ ...fn })
                    setFunctionAssignmentForm(null)
                  }}
                >
                  <span>{fn.name}</span>
                  <span style={{ marginLeft: 8, display: 'inline-flex', gap: 4 }}>
                    {functionHasResponsible(fn.id) ? <span style={tinyBadgeStyle}>R</span> : null}
                  </span>
                </button>

                {selectedFunctionId === fn.id ? (
                  <>
                    <button style={buttonStyle} onClick={() => moveItem('functions', siblings, fn.id, 'up')}>↑</button>
                    <button style={buttonStyle} onClick={() => moveItem('functions', siblings, fn.id, 'down')}>↓</button>
                  </>
                ) : null}

                <button style={buttonStyle} onClick={() => setFunctionForm(emptyFunction(selectedAreaId, fn.id))}>+ Sub</button>
              </div>

              {renderFunctionTree(fn.id, depth + 1)}
            </div>
          )
        })}
      </div>
    )
  }

  function renderAreasTab() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={boxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <strong>Áreas</strong>
            <button onClick={() => { setAreaForm(emptyArea()); setSelectedAreaId('') }} style={primaryButtonStyle}>+ Criar</button>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            {filteredAreas.map((row) => (
              <div key={row.id} style={{ display: 'flex', gap: 6 }}>
                <button
                  style={{ ...(selectedAreaId === row.id ? primaryButtonStyle : buttonStyle), flex: 1, textAlign: 'left' }}
                  onClick={() => {
                    setSelectedAreaId(row.id)
                    setAreaForm({ ...row })
                    if (functionForm?.area_id !== row.id) {
                      setSelectedFunctionId('')
                      setFunctionForm(null)
                      setFunctionAssignmentForm(null)
                    }
                    setAreaAssignmentForm(null)
                  }}
                >
                  {row.name}
                </button>

                {selectedAreaId === row.id ? (
                  <>
                    <button style={buttonStyle} onClick={() => moveItem('areas', filteredAreas, row.id, 'up')}>↑</button>
                    <button style={buttonStyle} onClick={() => moveItem('areas', filteredAreas, row.id, 'down')}>↓</button>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }} ref={areaEditorRef}>
          {areaForm ? (
            <div style={boxStyle}>
              <div style={{ display: 'grid', gap: 10 }}>
                <label>Nome<input style={inputStyle} value={areaForm.name} onChange={(e) => setAreaForm((s) => ({ ...s, name: e.target.value }))} /></label>
                <label>Notas<textarea style={{ ...inputStyle, minHeight: 80 }} value={areaForm.description ?? ''} onChange={(e) => setAreaForm((s) => ({ ...s, description: e.target.value }))} /></label>
                <label>Notas<textarea style={{ ...inputStyle, minHeight: 80 }} value={areaForm.notes ?? ''} onChange={(e) => setAreaForm((s) => ({ ...s, notes: e.target.value }))} /></label>
                <label>Estado<select style={inputStyle} value={areaForm.status} onChange={(e) => setAreaForm((s) => ({ ...s, status: e.target.value }))}><option value="active">active</option><option value="inactive">inactive</option><option value="archived">archived</option></select></label>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button style={primaryButtonStyle} onClick={saveArea}>Gravar área</button>
                  <button style={buttonStyle} onClick={() => setAreaForm(null)}>Cancelar</button>
                  {areaForm.id ? <button style={dangerButtonStyle} onClick={() => removeRow('areas', areaForm.id)}>Apagar</button> : null}
                </div>
              </div>
            </div>
          ) : null}

          {selectedAreaId ? (
            <>
              <div style={boxStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                  <button
                    style={{ ...buttonStyle, textAlign: 'left', fontWeight: 700 }}
                    onClick={() => setAreaAssignmentForm(emptyAreaAssignment(selectedAreaId))}
                  >
                    Responsáveis da área +
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  {areaAssignments.map((row) => (
                    <button key={row.id} style={{ ...buttonStyle, textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => setAreaAssignmentForm({ ...row })}>
                      {personName(row.person_id)} · {row.assignment_role}
                    </button>
                  ))}

                  {!areaAssignments.length ? <div style={{ fontSize: 12, color: '#5f6f66' }}>Sem responsáveis atribuídos.</div> : null}
                </div>

                {areaAssignmentForm && areaAssignmentForm.area_id === selectedAreaId ? (
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    <label>Pessoa<select style={inputStyle} value={areaAssignmentForm.person_id} onChange={(e) => setAreaAssignmentForm((s) => ({ ...s, person_id: e.target.value }))}><option value="">Escolher</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                    <label>Papel<select style={inputStyle} value={areaAssignmentForm.assignment_role} onChange={(e) => setAreaAssignmentForm((s) => ({ ...s, assignment_role: e.target.value }))}>{areaRoleOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!areaAssignmentForm.is_primary} onChange={(e) => setAreaAssignmentForm((s) => ({ ...s, is_primary: e.target.checked }))} />Principal</label>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button style={primaryButtonStyle} onClick={saveAreaAssignment}>Gravar responsável</button>
                      <button style={buttonStyle} onClick={() => setAreaAssignmentForm(null)}>Cancelar</button>
                      {areaAssignmentForm.id ? <button style={dangerButtonStyle} onClick={() => removeRow('area_people', areaAssignmentForm.id)}>Apagar</button> : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={boxStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                  <strong>Funções e subfunções</strong>
                  <button style={primaryButtonStyle} onClick={() => setFunctionForm(emptyFunction(selectedAreaId, ''))}>+ Nova função</button>
                </div>

                {renderFunctionTree()}
              </div>

              {functionForm && functionForm.area_id === selectedAreaId ? (
                <div style={boxStyle}>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <label>Função mãe<select style={inputStyle} value={functionForm.parent_function_id ?? ''} onChange={(e) => setFunctionForm((s) => ({ ...s, parent_function_id: e.target.value }))}><option value="">Nenhuma</option>{areaFunctions.filter((x) => x.id !== functionForm.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                    <label>Nome<input style={inputStyle} value={functionForm.name} onChange={(e) => setFunctionForm((s) => ({ ...s, name: e.target.value }))} /></label>
                    <label>Notas<textarea style={{ ...inputStyle, minHeight: 80 }} value={functionForm.description ?? ''} onChange={(e) => setFunctionForm((s) => ({ ...s, description: e.target.value }))} /></label>
                    <label>Notas<textarea style={{ ...inputStyle, minHeight: 80 }} value={functionForm.notes ?? ''} onChange={(e) => setFunctionForm((s) => ({ ...s, notes: e.target.value }))} /></label>
                    <label>Estado<select style={inputStyle} value={functionForm.status} onChange={(e) => setFunctionForm((s) => ({ ...s, status: e.target.value }))}><option value="active">active</option><option value="inactive">inactive</option><option value="archived">archived</option></select></label>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button style={primaryButtonStyle} onClick={saveFunction}>Gravar função</button>
                      <button style={buttonStyle} onClick={() => setFunctionForm(null)}>Cancelar</button>
                      {functionForm.id ? <button style={dangerButtonStyle} onClick={() => removeRow('functions', functionForm.id)}>Apagar</button> : null}
                    </div>

                    {functionForm.id ? (
                      <div style={subtleBoxStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                          <button
                            style={{ ...buttonStyle, textAlign: 'left', fontWeight: 700 }}
                            onClick={() => setFunctionAssignmentForm(emptyFunctionAssignment(functionForm.id))}
                          >
                            Responsáveis da função +
                          </button>
                        </div>

                        <div style={{ display: 'grid', gap: 6 }}>
                          {functionAssignments.map((row) => (
                            <button key={row.id} style={{ ...buttonStyle, textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => setFunctionAssignmentForm({ ...row })}>
                              {personName(row.person_id)} · {row.assignment_role}
                            </button>
                          ))}

                          {!functionAssignments.length ? <div style={{ fontSize: 12, color: '#5f6f66' }}>Sem responsáveis atribuídos.</div> : null}
                        </div>

                        {functionAssignmentForm && functionAssignmentForm.function_id === functionForm.id ? (
                          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                            <label>Pessoa<select style={inputStyle} value={functionAssignmentForm.person_id} onChange={(e) => setFunctionAssignmentForm((s) => ({ ...s, person_id: e.target.value }))}><option value="">Escolher</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                            <label>Papel<select style={inputStyle} value={functionAssignmentForm.assignment_role} onChange={(e) => setFunctionAssignmentForm((s) => ({ ...s, assignment_role: e.target.value }))}>{genericRoleOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!functionAssignmentForm.is_primary} onChange={(e) => setFunctionAssignmentForm((s) => ({ ...s, is_primary: e.target.checked }))} />Principal</label>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button style={primaryButtonStyle} onClick={saveFunctionAssignment}>Gravar responsável</button>
                              <button style={buttonStyle} onClick={() => setFunctionAssignmentForm(null)}>Cancelar</button>
                              {functionAssignmentForm.id ? <button style={dangerButtonStyle} onClick={() => removeRow('function_people', functionAssignmentForm.id)}>Apagar</button> : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    )
  }

  function renderProjectsTab() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={boxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <strong>Projetos</strong>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                style={buttonStyle}
                onClick={() => {
                  const allProjectIds = filteredProjects.map((project) => project.id)
                  const hasOpenProjects = openProjects.length > 0

                  if (hasOpenProjects) {
                    clearPendingWorkItemDrafts()
                    setOpenProjects([])
                    setSelectedProjectId('')
                    setSelectedWorkItemId('')
                    setWorkItemForm(null)
                    setWorkItemAssignmentForm(null)
                    setDependencyForm(null)
                  } else {
                    setOpenProjects(allProjectIds)
                  }
                }}
              >
                {openProjects.length > 0 ? 'Fechar todos' : 'Abrir todos'}
              </button>
              <button style={primaryButtonStyle} onClick={() => {
                clearPendingWorkItemDrafts()
                setOpenProjects([])
                setSelectedProjectId('')
                setSelectedWorkItemId('')
                setWorkItemAssignmentForm(null)
                setDependencyForm(null)
                setWorkItemForm(emptyWorkItem('', 'project'))
              }}>+ Criar projeto</button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            {filteredProjects.map((project) => {
              const isOpen = openProjects.includes(project.id)
              const projectTasks = projectTasksMap.get(project.id) ?? []
              const projectHasR = workItemHasResponsible(project.id)
              const projectHasD = workItemHasDependency(project.id)

              return (
                <div key={project.id} style={{ border: '1px solid #dfe7da', borderRadius: 10, padding: 8, display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      style={{ ...(selectedProjectId === project.id ? primaryButtonStyle : buttonStyle), flex: 1, textAlign: 'left' }}
                      onClick={() => {
                        setSelectedProjectId(project.id)
                        setSelectedWorkItemId(project.id)
                        clearPendingWorkItemDrafts()
                        setWorkItemForm({ ...project })
                      }}
                    >
                      <span>{project.name}</span>
                      <span style={{ marginLeft: 8, display: 'inline-flex', gap: 4 }}>
                        {projectHasR ? <span style={tinyBadgeStyle}>R</span> : null}
                        {projectHasD ? <span style={tinyBadgeStyle}>D</span> : null}
                        {workItemHasDueDate(project.id) ? <span style={calendarBadgeStyle}><CalendarTinyIcon /></span> : null}
                      </span>
                    </button>

                    {selectedProjectId === project.id ? (
                      <>
                        <button style={buttonStyle} onClick={() => moveItem('work_items', filteredProjects, project.id, 'up')}>↑</button>
                        <button style={buttonStyle} onClick={() => moveItem('work_items', filteredProjects, project.id, 'down')}>↓</button>
                      </>
                    ) : null}

                    <button
                      style={{ ...buttonStyle, fontSize: 28, fontWeight: 700, minWidth: 54, minHeight: 46, lineHeight: 1, padding: '4px 10px' }}
                      onClick={() => {
                        const nextOpen = !isOpen
                        setOpenProjects((prev) => toggleInArray(prev, project.id))
                        if (!nextOpen && selectedProjectId === project.id) {
                          setSelectedProjectId('')
                          setSelectedWorkItemId('')
                          setWorkItemForm(null)
                          setWorkItemAssignmentForm(null)
                          setDependencyForm(null)
                          clearPendingWorkItemDrafts()
                        }
                      }}
                    >
                      {isOpen ? '▾' : '▸'}
                    </button>

                    <button style={buttonStyle} onClick={() => { clearPendingWorkItemDrafts(); setSelectedWorkItemId(''); setWorkItemForm(emptyWorkItem(project.id, 'task')) }}>+ Tarefa</button>
                  </div>

                  {isOpen ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {(projectTasksMap.get(project.id) ?? []).map((item) => {
                        const siblings = projectTasks.filter((x) => (x.parent_work_item_id ?? '') === (item.parent_work_item_id ?? ''))
                        const hasR = workItemHasResponsible(item.id)
                        const hasD = workItemHasDependency(item.id)

                        return (
                          <div key={item.id} style={{ display: 'flex', gap: 6, marginLeft: item.depth * 16 }}>
                            <button
                              style={{ ...(selectedWorkItemId === item.id ? primaryButtonStyle : buttonStyle), flex: 1, textAlign: 'left' }}
                              onClick={() => {
                                setSelectedProjectId(project.id)
                                setSelectedWorkItemId(item.id)
                                setWorkItemForm({ ...item })
                                setWorkItemAssignmentForm(null)
                                setDependencyForm(null)
                              }}
                            >
                              <span>{workItemLabel(item)}</span>
                              <span style={{ marginLeft: 8, display: 'inline-flex', gap: 4 }}>
                                {hasR ? <span style={tinyBadgeStyle}>R</span> : null}
                                {hasD ? <span style={tinyBadgeStyle}>D</span> : null}
                                {workItemHasDueDate(item.id) ? <span style={calendarBadgeStyle}><CalendarTinyIcon /></span> : null}
                              </span>
                            </button>

                            {selectedWorkItemId === item.id ? (
                              <>
                                <button style={buttonStyle} onClick={() => moveItem('work_items', siblings, item.id, 'up')}>↑</button>
                                <button style={buttonStyle} onClick={() => moveItem('work_items', siblings, item.id, 'down')}>↓</button>
                              </>
                            ) : null}

                            {canCreateSubtask(item) ? (
                              <button
                                style={buttonStyle}
                                onClick={() => {
                                  clearPendingWorkItemDrafts()
                                  setSelectedWorkItemId('')
                                  setWorkItemForm(emptyWorkItem(item.id, 'subtask'))
                                }}
                              >
                                + Sub
                              </button>
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
        </div>

        <div ref={projectEditorRef} style={{ display: 'grid', gap: 16 }}>
          {workItemForm ? (
            <div style={boxStyle}>
              <div style={{ display: 'grid', gap: 10 }}>
                <label>Tipo<select style={inputStyle} value={workItemForm.type} onChange={(e) => setWorkItemForm((s) => ({ ...s, type: e.target.value }))}>{workItemTypeOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label>Item pai<select style={inputStyle} value={workItemForm.parent_work_item_id ?? ''} onChange={(e) => setWorkItemForm((s) => ({ ...s, parent_work_item_id: e.target.value }))}><option value="">Nenhum</option>{workItems.filter((x) => x.id !== workItemForm.id).map((x) => <option key={x.id} value={x.id}>{workItemLabel(x)}</option>)}</select></label>
                <label>Nome<input style={inputStyle} value={workItemForm.name} onChange={(e) => setWorkItemForm((s) => ({ ...s, name: e.target.value }))} /></label>
                <label>Notas<textarea style={{ ...inputStyle, minHeight: 80 }} value={workItemForm.description ?? ''} onChange={(e) => setWorkItemForm((s) => ({ ...s, description: e.target.value }))} /></label>
                <label>Prazo<input type="date" style={inputStyle} value={workItemForm.due_date ?? ''} onChange={(e) => setWorkItemForm((s) => ({ ...s, due_date: e.target.value }))} /></label>
                <label>Estado<select style={inputStyle} value={workItemForm.status} onChange={(e) => setWorkItemForm((s) => ({ ...s, status: e.target.value }))}>{workItemStatusOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label>Fase<select style={inputStyle} value={workItemForm.phase} onChange={(e) => setWorkItemForm((s) => ({ ...s, phase: e.target.value }))}>{phaseOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label>Prioridade<select style={inputStyle} value={workItemForm.priority} onChange={(e) => setWorkItemForm((s) => ({ ...s, priority: e.target.value }))}>{priorityOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>

              </div>

              {workItemForm ? (
                <div style={{ ...subtleBoxStyle, marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <button
                      style={{ ...buttonStyle, textAlign: 'left', fontWeight: 700 }}
                      onClick={() => {
                        const targetId = workItemForm.id || DRAFT_WORK_ITEM_ID
                        if (workItemAssignmentForm?.work_item_id === targetId) {
                          setWorkItemAssignmentForm(null)
                        } else {
                          setDependencyForm(null)
                          setWorkItemAssignmentForm(emptyWorkItemAssignment(targetId))
                        }
                      }}
                    >
                      {workItemForm.type === 'project' ? 'Responsáveis deste projeto +' : 'Responsáveis desta tarefa +'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    {displayedWorkItemAssignments.map((row, idx) => (
                      <button key={row.id || `draft-assignment-${idx}`} style={{ ...buttonStyle, textAlign: 'left', justifyContent: 'flex-start', width: '100%' }} onClick={() => setWorkItemAssignmentForm({ ...row })}>
                        {personName(row.person_id)} · {row.assignment_role}
                      </button>
                    ))}

                    {!displayedWorkItemAssignments.length && !workItemAssignmentForm ? <div style={{ fontSize: 12, color: '#5f6f66' }}>Sem responsáveis atribuídos.</div> : null}
                  </div>

                  {workItemAssignmentForm && workItemAssignmentForm.work_item_id === (workItemForm.id || DRAFT_WORK_ITEM_ID) ? (
                    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                      <label>Pessoa<select style={inputStyle} value={workItemAssignmentForm.person_id} onChange={(e) => setWorkItemAssignmentForm((s) => ({ ...s, person_id: e.target.value }))}><option value="">Escolher</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                      <label>Papel<select style={inputStyle} value={workItemAssignmentForm.assignment_role} onChange={(e) => setWorkItemAssignmentForm((s) => ({ ...s, assignment_role: e.target.value }))}>{genericRoleOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!workItemAssignmentForm.is_primary} onChange={(e) => setWorkItemAssignmentForm((s) => ({ ...s, is_primary: e.target.checked }))} />Principal</label>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {workItemForm.id ? (
                          <button style={primaryButtonStyle} onClick={saveWorkItemAssignment}>Gravar responsável</button>
                        ) : (
                          <button
                            style={primaryButtonStyle}
                            onClick={() => {
                              if (!workItemAssignmentForm?.person_id) {
                                setError('Escolhe uma pessoa.')
                                return
                              }
                              setPendingWorkItemAssignments((prev) => {
                                const filtered = prev.filter((x) => x.id !== workItemAssignmentForm.id)
                                return [...filtered, { ...workItemAssignmentForm, id: workItemAssignmentForm.id || `draft-${Date.now()}` }]
                              })
                              setWorkItemAssignmentForm(null)
                            }}
                          >
                            Adicionar responsável
                          </button>
                        )}
                        <button style={buttonStyle} onClick={() => setWorkItemAssignmentForm(null)}>Cancelar</button>
                        {workItemForm.id && workItemAssignmentForm.id ? <button style={dangerButtonStyle} onClick={() => removeRow('work_item_people', workItemAssignmentForm.id)}>Apagar</button> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {workItemForm && workItemForm.type !== 'project' ? (
                <div style={{ ...subtleBoxStyle, marginTop: 14 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ fontSize: 13 }}>Dependências desta tarefa</strong>
                  </div>

                  {otherProjectTaskOptions.length ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div><button style={primaryButtonStyle} onClick={() => {
                          const next = { ...emptyDependency(workItemForm.id || DRAFT_WORK_ITEM_ID, 'incoming'), direction: 'incoming' }
                          if (dependencyForm?.direction === 'incoming') {
                            setDependencyForm(null)
                          } else {
                            setWorkItemAssignmentForm(null)
                            setDependencyForm(next)
                          }
                        }}>+ Esta tarefa depende de...</button></div>
                        <strong style={{ fontSize: 12 }}>O que bloqueia a tarefa:</strong>

                      {displayedIncomingDeps.map((dep, idx) => {
                        const pred = workItemMap.get(dep.predecessor_work_item_id)
                        return (
                          <button key={dep.id || `draft-in-${idx}`} style={{ ...buttonStyle, textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => { setWorkItemAssignmentForm(null); setDependencyForm({ ...dep, direction: dep.direction || 'incoming' }) }}>
                            {dependencySentence(pred?.name ?? 'Sem origem', workItemForm.name ?? 'Sem nome', dep.dependency_type)}
                          </button>
                        )
                      })}

                      {!displayedIncomingDeps.length && !(dependencyEditorMode === 'incoming') ? <div style={{ fontSize: 12, color: '#5f6f66' }}>Sem dependências de entrada.</div> : null}
                    </div>

                      <div style={{ display: 'grid', gap: 6 }}>
                        <div><button style={buttonStyle} onClick={() => {
                          const next = { ...emptyDependency(workItemForm.id || DRAFT_WORK_ITEM_ID, 'outgoing'), direction: 'outgoing' }
                          if (dependencyForm?.direction === 'outgoing') {
                            setDependencyForm(null)
                          } else {
                            setWorkItemAssignmentForm(null)
                            setDependencyForm(next)
                          }
                        }}>+ Esta tarefa bloqueia...</button></div>
                        <strong style={{ fontSize: 12 }}>O que esta tarefa bloqueia</strong>

                      {displayedOutgoingDeps.map((dep, idx) => {
                        const succ = workItemMap.get(dep.successor_work_item_id)
                        return (
                          <button key={dep.id || `draft-in-${idx}`} style={{ ...buttonStyle, textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => { setWorkItemAssignmentForm(null); setDependencyForm({ ...dep, direction: dep.direction || 'outgoing' }) }}>
                            {outgoingDependencySentence(workItemForm.name ?? 'Sem nome', succ?.name ?? 'Sem destino', dep.dependency_type)}
                          </button>
                        )
                      })}

                      {!displayedOutgoingDeps.length && !(dependencyEditorMode === 'outgoing') ? <div style={{ fontSize: 12, color: '#5f6f66' }}>Sem dependências de saída.</div> : null}
                    </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#5f6f66' }}>
                      Ainda não há outras tarefas neste projeto para criar dependências.
                    </div>
                  )}

                  {otherProjectTaskOptions.length && dependencyForm ? (
                    <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                      {dependencyEditorMode === 'incoming' ? (
                        <label>Tarefa origem<select style={inputStyle} value={dependencyForm.predecessor_work_item_id} onChange={(e) => setDependencyForm((s) => ({ ...s, predecessor_work_item_id: e.target.value }))}><option value="">Escolher</option>{otherProjectTaskOptions.map((x) => <option key={x.id} value={x.id}>{workItemLabel(x)}</option>)}</select></label>
                      ) : dependencyEditorMode === 'outgoing' ? (
                        <label>Tarefa destino<select style={inputStyle} value={dependencyForm.successor_work_item_id} onChange={(e) => setDependencyForm((s) => ({ ...s, successor_work_item_id: e.target.value }))}><option value="">Escolher</option>{otherProjectTaskOptions.map((x) => <option key={x.id} value={x.id}>{workItemLabel(x)}</option>)}</select></label>
                      ) : null}
                      <label>Tipo de dependência<select style={inputStyle} value={dependencyForm.dependency_type} onChange={(e) => setDependencyForm((s) => ({ ...s, dependency_type: e.target.value }))}>{dependencyTypeOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                      <label>Lag em dias<input type="number" style={inputStyle} value={dependencyForm.lag_days ?? 0} onChange={(e) => setDependencyForm((s) => ({ ...s, lag_days: e.target.value }))} /></label>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {workItemForm.id ? (
                          <button style={primaryButtonStyle} onClick={saveDependency}>Gravar dependência</button>
                        ) : (
                          <button
                            style={primaryButtonStyle}
                            onClick={() => {
                              if (!dependencyForm?.predecessor_work_item_id && !dependencyForm?.successor_work_item_id) {
                                setError('Define pelo menos a origem ou o destino.')
                                return
                              }
                              if (!dependencyForm?.dependency_type) {
                                setError('Escolhe o tipo de dependência.')
                                return
                              }
                              setPendingDependencies((prev) => {
                                const filtered = prev.filter((x) => x.id !== dependencyForm.id)
                                return [...filtered, { ...dependencyForm, id: dependencyForm.id || `draft-${Date.now()}` }]
                              })
                              setDependencyForm(null)
                            }}
                          >
                            Adicionar dependência
                          </button>
                        )}
                        <button style={buttonStyle} onClick={() => setDependencyForm(null)}>Cancelar</button>
                        {workItemForm.id && dependencyForm.id ? <button style={dangerButtonStyle} onClick={() => removeRow('work_item_dependencies', dependencyForm.id)}>Apagar</button> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {workItemForm ? (
                <div style={{ ...subtleBoxStyle, marginTop: 14, position: 'sticky', bottom: 10, zIndex: 5, background: '#fbfcfa', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {workItemForm.id ? (
                      <>
                        <button style={primaryButtonStyle} onClick={saveWorkItem}>
                          {workItemForm.type === 'project' ? 'Gravar projeto' : 'Gravar tarefa'}
                        </button>
                        <button style={buttonStyle} onClick={() => { clearPendingWorkItemDrafts(); setWorkItemForm(null) }}>Cancelar</button>
                        <button style={dangerButtonStyle} onClick={() => removeRow('work_items', workItemForm.id)}>Apagar</button>
                        {workItemForm.type !== 'project' && canCreateSubtask(workItemForm) ? (
                          <button style={buttonStyle} onClick={() => { clearPendingWorkItemDrafts(); setSelectedWorkItemId(''); setWorkItemForm(emptyWorkItem(workItemForm.id, 'subtask')) }}>
                            + Criar subtarefa
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <button style={primaryButtonStyle} onClick={saveWorkItem}>
                          {workItemForm.type === 'project'
                            ? 'Criar projeto'
                            : workItemForm.type === 'subtask'
                              ? 'Criar subtarefa'
                              : 'Criar tarefa'}
                        </button>
                        <button style={buttonStyle} onClick={() => { clearPendingWorkItemDrafts(); setWorkItemForm(null) }}>Cancelar</button>
                      </>
                    )}
                  </div>
                </div>
              ) : null}

            </div>
          ) : null}
        </div>
      </div>
    )
  }

  function togglePeopleSection(personId, sectionKey) {
    const key = `${personId}:${sectionKey}`
    const current = collapsedPeopleSections[key]
    const nextValue = current === undefined ? false : !current
    setCollapsedPeopleSections((prev) => ({ ...prev, [key]: nextValue }))
  }

  function isPeopleSectionCollapsed(personId, sectionKey, defaultCollapsed = true) {
    const value = collapsedPeopleSections[`${personId}:${sectionKey}`]
    return value === undefined ? defaultCollapsed : !!value
  }

  function togglePeopleAreaCard(personId, areaKey) {
    const key = `${personId}:${areaKey}`
    const current = collapsedPeopleAreaCards[key]
    const nextValue = current === undefined ? false : !current
    setCollapsedPeopleAreaCards((prev) => ({ ...prev, [key]: nextValue }))
  }

  function isPeopleAreaCardCollapsed(personId, areaKey, defaultCollapsed = true) {
    const value = collapsedPeopleAreaCards[`${personId}:${areaKey}`]
    return value === undefined ? defaultCollapsed : !!value
  }

  function renderPeopleTab() {
    const operational = personForm?.id ? personOperationalData(personForm.id) : null
    const areasCollapsed = personForm?.id ? isPeopleSectionCollapsed(personForm.id, 'areas', true) : true
    const involvedCollapsed = personForm?.id ? isPeopleSectionCollapsed(personForm.id, 'involved', true) : true

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={boxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <strong>Pessoas</strong>
            <button style={primaryButtonStyle} onClick={() => { setPersonForm(emptyPerson()); setSelectedPersonId('') }}>+ Criar</button>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            {filteredPeople.map((row) => (
              <button
                key={row.id}
                style={{ ...(selectedPersonId === row.id ? primaryButtonStyle : buttonStyle), textAlign: 'left' }}
                onClick={() => {
                  setSelectedPersonId(row.id)
                  setPersonForm({ ...row })
                }}
              >
                {row.name}
              </button>
            ))}
          </div>
        </div>

        <div ref={peopleEditorRef} style={{ display: 'grid', gap: 16 }}>
          {personForm ? (
            <>
              <div style={boxStyle}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <label>Nome<input style={inputStyle} value={personForm.name} onChange={(e) => setPersonForm((s) => ({ ...s, name: e.target.value }))} /></label>
                  <label>Email<input style={inputStyle} value={personForm.email ?? ''} onChange={(e) => setPersonForm((s) => ({ ...s, email: e.target.value }))} /></label>
                  <label>Cargo / título<input style={inputStyle} value={personForm.role_title ?? ''} onChange={(e) => setPersonForm((s) => ({ ...s, role_title: e.target.value }))} /></label>
                  <label>Estado<select style={inputStyle} value={personForm.status} onChange={(e) => setPersonForm((s) => ({ ...s, status: e.target.value }))}><option value="active">active</option><option value="inactive">inactive</option></select></label>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button style={primaryButtonStyle} onClick={savePerson}>Gravar</button>
                    <button style={buttonStyle} onClick={() => setPersonForm(null)}>Cancelar</button>
                    {personForm.id ? <button style={dangerButtonStyle} onClick={() => removeRow('people', personForm.id)}>Apagar</button> : null}
                  </div>
                </div>
              </div>

              {personForm.id ? (
                <>
                  <div style={boxStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <strong>Responsabilidades por áreas</strong>
                      <button style={buttonStyle} onClick={() => togglePeopleSection(personForm.id, 'areas')}>{areasCollapsed ? '+' : '−'}</button>
                    </div>

                    {!areasCollapsed ? (
                      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                        {operational?.areaCards?.length ? (
                          operational.areaCards.map((area) => {
                            const areaCollapsed = isPeopleAreaCardCollapsed(personForm.id, area.key, true)

                            return (
                              <div key={area.key} style={subtleBoxStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                                  <strong>{area.areaName}</strong>
                                  <button style={buttonStyle} onClick={() => togglePeopleAreaCard(personForm.id, area.key)}>{areaCollapsed ? '+' : '−'}</button>
                                </div>

                                {!areaCollapsed ? (
                                  <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                                    <div>
                                      <strong style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>Responsabilidades na área</strong>
                                      {area.areaAssignments.length ? (
                                        <div style={{ display: 'grid', gap: 6 }}>
                                          {area.areaAssignments.map((row) => (
                                            <div key={row.id} style={{ ...subtleBoxStyle, textAlign: 'left', display: 'grid', justifyItems: 'start' }}>
                                              <div style={{ fontSize: 12, color: '#5f6f66' }}>
                                                {row.role}{row.isPrimary ? ' · principal' : ''}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div style={{ fontSize: 12, color: '#5f6f66' }}>Sem responsabilidade direta na área.</div>
                                      )}
                                    </div>

                                    <div>
                                      <strong style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>Responsabilidades por funções</strong>
                                      {area.functionAssignments.length ? (
                                        <div style={{ display: 'grid', gap: 6 }}>
                                          {area.functionAssignments.map((row) => (
                                            <div key={row.id} style={{ ...subtleBoxStyle, textAlign: 'left', display: 'grid', justifyItems: 'start' }}>
                                              <div><strong>{row.functionName}</strong></div>
                                              <div style={{ fontSize: 12, color: '#5f6f66', marginTop: 4 }}>
                                                {row.role}{row.isPrimary ? ' · principal' : ''}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div style={{ fontSize: 12, color: '#5f6f66' }}>Sem funções atribuídas nesta área.</div>
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            )
                          })
                        ) : (
                          <div style={{ fontSize: 12, color: '#5f6f66' }}>Sem áreas ou funções atribuídas.</div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div style={boxStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <strong>Projetos e tarefas em que está envolvido</strong>
                      <button style={buttonStyle} onClick={() => togglePeopleSection(personForm.id, 'involved')}>{involvedCollapsed ? '+' : '−'}</button>
                    </div>

                    {!involvedCollapsed ? (
                      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                        {operational?.involvedItems?.length ? (
                          operational.involvedItems.map((row) => (
                            <div key={row.id} style={{ ...subtleBoxStyle, textAlign: 'left', display: 'grid', justifyItems: 'start' }}>
                              <div><strong>{row.projectName || 'Sem projeto'}</strong></div>
                              <div style={{ marginTop: 4 }}>{workItemTypeLabel(row.workItemType)}: {row.workItemName}</div>
                              <div style={{ fontSize: 12, color: '#5f6f66', marginTop: 4 }}>
                                {row.role}{row.isPrimary ? ' · principal' : ''}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: 12, color: '#5f6f66' }}>Sem envolvimento em projetos ou tarefas.</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
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
          color: #1d2a21;
          background: #f6f8f4;
        }

        html, body, #root {
          margin: 0;
          min-height: 100%;
          width: 100%;
        }

        body {
          background: #f6f8f4;
          color: #1d2a21;
        }

        * {
          box-sizing: border-box;
        }

        label {
          display: grid;
          gap: 4px;
          font-size: 12px;
          color: #46604d;
        }

        select, input, textarea, button {
          font: inherit;
        }

        textarea {
          resize: vertical;
        }
      `}</style>

      <div style={{ maxWidth: 1700, margin: '0 auto', padding: '24px 18px 40px' }}>
        <header style={{ marginBottom: 18 }}>
          <img src="https://img.brainstormphda.pt/marca/logo/BPHDA_logo_pt_horizontal_verde.png" alt="BPHDA" style={{ display: 'block', height: 34, width: 'auto', marginBottom: 14 }} />
          <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.05, color: '#16361f' }}>Editor de dados</h1>

          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="/" style={{ ...buttonStyle, textDecoration: 'none', display: 'inline-block' }}>Voltar à vista principal</a>
            <button onClick={loadAll} style={buttonStyle}>Recarregar dados</button>
            <button onClick={exportToExcel} style={buttonStyle}>Exportar Excel</button>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input style={{ ...inputStyle, maxWidth: 280 }} placeholder="Buscar no editor" value={query} onChange={(e) => setQuery(e.target.value)} />
              {query ? <button style={buttonStyle} onClick={clearSearch}>Limpar</button> : null}
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            ['areas', 'Áreas'],
            ['people', 'Pessoas'],
            ['projects', 'Projetos e tarefas'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setTab(key)
                if (key !== 'projects') {
                  setSelectedProjectId('')
                  setSelectedWorkItemId('')
                  setWorkItemForm(null)
                  setWorkItemAssignmentForm(null)
                  setDependencyForm(null)
                  clearPendingWorkItemDrafts()
                }
              }}
              style={tab === key ? primaryButtonStyle : buttonStyle}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? <div style={boxStyle}>A carregar...</div> : null}
        {!loading && error ? <div style={{ ...boxStyle, background: '#fff4f4', borderColor: '#efcaca', color: '#8a2f2f', marginBottom: 12 }}>{error}</div> : null}
        {!loading && message ? <div style={{ ...boxStyle, background: '#eef6e8', borderColor: '#cfe0c4', color: '#35513c', marginBottom: 12 }}>{message}</div> : null}

        {!loading && query.trim() ? (
          <div style={{ ...boxStyle, marginBottom: 12 }}>
            <strong style={{ display: 'block', marginBottom: 8 }}>Resultados da pesquisa</strong>
            {searchResults.length ? (
              <div style={{ display: 'grid', gap: 6 }}>
                {searchResults.map((result) => (
                  <button
                    key={result.key}
                    style={{ ...buttonStyle, textAlign: 'left', justifyContent: 'flex-start', borderRadius: 10, padding: '10px 12px' }}
                    onClick={() => openSearchResult(result)}
                  >
                    <span>
                      <strong>{result.title}</strong>
                      <span style={{ color: '#5f6f66' }}> · {result.field}</span>
                      {result.preview ? <span style={{ display: 'block', marginTop: 4, color: '#35513c' }}>{result.preview}</span> : null}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#5f6f66' }}>Sem resultados com contexto.</div>
            )}
          </div>
        ) : null}

        {!loading && tab === 'areas' ? renderAreasTab() : null}
        {!loading && tab === 'projects' ? renderProjectsTab() : null}
        {!loading && tab === 'people' ? renderPeopleTab() : null}
      </div>
    </>
  )
}

createRoot(document.getElementById('root')).render(<EditorApp />)
