import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase } from './supabaseClient'

const itemTypes = [
  ['project', 'Projeto'],
  ['task', 'Tarefa'],
  ['subtask', 'Subtarefa'],
  ['milestone', 'Marco'],
]

const workStatuses = [
  ['not_started', 'Não iniciada'],
  ['in_progress', 'Em curso'],
  ['blocked', 'Bloqueada'],
  ['done', 'Concluída'],
  ['cancelled', 'Cancelada'],
]

const phases = [
  ['planning', 'Planeamento'],
  ['execution', 'Execução'],
  ['review', 'Revisão'],
  ['completed', 'Concluído'],
]

const priorities = [
  ['low', 'Baixa'],
  ['medium', 'Média'],
  ['high', 'Alta'],
  ['critical', 'Crítica'],
]

const areaRoles = [
  ['lead', 'Responsável'],
  ['co_lead', 'Co-responsável'],
  ['support', 'Apoio'],
  ['informed', 'Informado'],
]

const genericRoles = [
  ['owner', 'Responsável'],
  ['co_owner', 'Co-responsável'],
  ['assignee', 'Executante'],
  ['contributor', 'Contribui'],
  ['approver', 'Aprova'],
  ['reviewer', 'Revê'],
  ['watcher', 'Acompanha'],
  ['informed', 'Informado'],
]

const dependencyTypes = [
  ['finish_to_start', 'Só começa depois da anterior terminar'],
  ['start_to_start', 'Só começa quando a anterior começar'],
  ['finish_to_finish', 'Só termina depois da anterior terminar'],
  ['blocks', 'Bloqueia enquanto não estiver resolvida'],
  ['related_to', 'Relacionada'],
]

const boxStyle = {
  background: '#ffffff',
  border: '1px solid #dfe7da',
  borderRadius: 12,
  padding: 14,
}

const subtleBoxStyle = {
  background: '#fbfcfa',
  border: '1px solid #e3eadf',
  borderRadius: 10,
  padding: 10,
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #cfd9ca',
  fontSize: 13,
  background: '#fff',
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

const dragHandleStyle = {
  display: 'inline-flex',
  width: 26,
  height: 26,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 7,
  border: '1px solid #dfe7da',
  cursor: 'grab',
  userSelect: 'none',
  background: '#fff',
}

function labelFor(options, value) {
  return Object.fromEntries(options)[value] ?? value
}

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
function emptyProject() {
  return {
    id: '',
    parent_work_item_id: '',
    type: 'project',
    name: '',
    description: '',
    status: 'not_started',
    phase: 'planning',
    priority: 'medium',
    sort_order: 0,
  }
}
function emptyTask(parentId = '', type = 'task') {
  return {
    id: '',
    parent_work_item_id: parentId,
    type,
    name: '',
    description: '',
    status: 'not_started',
    phase: 'planning',
    priority: 'medium',
    sort_order: 0,
  }
}
function emptyPerson() {
  return { id: '', name: '', email: '', role_title: '', status: 'active' }
}
function emptyAreaAssignment(areaId = '') {
  return { id: '', area_id: areaId, person_id: '', assignment_role: 'lead', is_primary: true }
}
function emptyFunctionAssignment(functionId = '') {
  return { id: '', function_id: functionId, person_id: '', assignment_role: 'owner', is_primary: true }
}
function emptyWorkItemAssignment(workItemId = '') {
  return { id: '', work_item_id: workItemId, person_id: '', assignment_role: 'owner', is_primary: true }
}
function emptyDependency(predecessorId = '', successorId = '') {
  return {
    id: '',
    predecessor_work_item_id: predecessorId,
    successor_work_item_id: successorId,
    dependency_type: 'finish_to_start',
    lag_days: 0,
    note: '',
  }
}

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

function reorderList(items, fromId, toId) {
  const fromIndex = items.findIndex((x) => x.id === fromId)
  const toIndex = items.findIndex((x) => x.id === toId)
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return items
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

async function persistSortOrder(table, items) {
  for (let index = 0; index < items.length; index += 1) {
    const res = await supabase.from(table).update({ sort_order: index + 1 }).eq('id', items[index].id)
    if (res.error) throw res.error
  }
}

function filterText(text, q) {
  if (!q) return true
  return (text ?? '').toLowerCase().includes(q.trim().toLowerCase())
}

function dependencySentence(predecessorName, successorName, type) {
  if (type === 'finish_to_start') return `[${successorName}] é bloqueada por [${predecessorName}] e só pode começar depois desta terminar`
  if (type === 'start_to_start') return `[${successorName}] depende de [${predecessorName}] e só pode começar quando esta começar`
  if (type === 'finish_to_finish') return `[${successorName}] depende de [${predecessorName}] e só pode terminar depois desta terminar`
  if (type === 'blocks') return `[${successorName}] é bloqueada por [${predecessorName}] enquanto esta não estiver resolvida`
  return `[${successorName}] está relacionada com [${predecessorName}]`
}

function EditorApp() {
  const [tab, setTab] = useState('areas')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [people, setPeople] = useState([])
  const [areas, setAreas] = useState([])
  const [functions, setFunctions] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [dependencies, setDependencies] = useState([])
  const [areaPeople, setAreaPeople] = useState([])
  const [functionPeople, setFunctionPeople] = useState([])
  const [workItemPeople, setWorkItemPeople] = useState([])

  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [selectedFunctionId, setSelectedFunctionId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedWorkItemId, setSelectedWorkItemId] = useState('')
  const [selectedAreaAssignmentId, setSelectedAreaAssignmentId] = useState('')
  const [selectedFunctionAssignmentId, setSelectedFunctionAssignmentId] = useState('')
  const [selectedWorkItemAssignmentId, setSelectedWorkItemAssignmentId] = useState('')
  const [selectedDependencyId, setSelectedDependencyId] = useState('')

  const [personForm, setPersonForm] = useState(null)
  const [areaForm, setAreaForm] = useState(null)
  const [functionForm, setFunctionForm] = useState(null)
  const [projectForm, setProjectForm] = useState(null)
  const [taskForm, setTaskForm] = useState(null)
  const [areaAssignmentForm, setAreaAssignmentForm] = useState(null)
  const [functionAssignmentForm, setFunctionAssignmentForm] = useState(null)
  const [workItemAssignmentForm, setWorkItemAssignmentForm] = useState(null)
  const [dependencyForm, setDependencyForm] = useState(null)

  const [expandedAreaIds, setExpandedAreaIds] = useState([])
  const [expandedProjectIds, setExpandedProjectIds] = useState([])

  const editorRef = useRef(null)
  const taskEditorRef = useRef(null)

  const [dragState, setDragState] = useState({ type: '', draggedId: '', scope: '', overId: '' })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    setError('')
    setMessage('')
    const [
      peopleRes,
      areasRes,
      functionsRes,
      workItemsRes,
      dependenciesRes,
      areaPeopleRes,
      functionPeopleRes,
      workItemPeopleRes,
    ] = await Promise.all([
      supabase.from('people').select('*').order('name', { ascending: true }),
      supabase.from('areas').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('functions').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('work_items').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('work_item_dependencies').select('*'),
      supabase.from('area_people').select('*'),
      supabase.from('function_people').select('*'),
      supabase.from('work_item_people').select('*'),
    ])
    const all = [peopleRes, areasRes, functionsRes, workItemsRes, dependenciesRes, areaPeopleRes, functionPeopleRes, workItemPeopleRes]
    const firstError = all.find((r) => r.error)
    if (firstError?.error) {
      setError(firstError.error.message)
      setLoading(false)
      return
    }
    setPeople(peopleRes.data ?? [])
    setAreas(areasRes.data ?? [])
    setFunctions(functionsRes.data ?? [])
    setWorkItems(workItemsRes.data ?? [])
    setDependencies(dependenciesRes.data ?? [])
    setAreaPeople(areaPeopleRes.data ?? [])
    setFunctionPeople(functionPeopleRes.data ?? [])
    setWorkItemPeople(workItemPeopleRes.data ?? [])
    setLoading(false)
  }

  function clearFeedback() {
    setError('')
    setMessage('')
  }

  function scrollToEditor(ref) {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }

  const peopleMap = useMemo(() => new Map(people.map((x) => [x.id, x])), [people])
  const areaMap = useMemo(() => new Map(areas.map((x) => [x.id, x])), [areas])
  const functionMap = useMemo(() => new Map(functions.map((x) => [x.id, x])), [functions])
  const workItemMap = useMemo(() => new Map(workItems.map((x) => [x.id, x])), [workItems])

  const sortedAreas = useMemo(() => [...areas].sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)||a.name.localeCompare(b.name,'pt')), [areas])
  const sortedFunctions = useMemo(() => [...functions].sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)||a.name.localeCompare(b.name,'pt')), [functions])
  const sortedWorkItems = useMemo(() => [...workItems].sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)||a.name.localeCompare(b.name,'pt')), [workItems])
  const projects = useMemo(() => sortedWorkItems.filter((x)=>x.type==='project'), [sortedWorkItems])

  const functionsByAreaParent = useMemo(() => {
    const grouped = new Map()
    for (const fn of sortedFunctions) {
      const key = `${fn.area_id}::${fn.parent_function_id ?? ''}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(fn)
    }
    return grouped
  }, [sortedFunctions])

  const workItemsByParent = useMemo(() => {
    const grouped = new Map()
    for (const item of sortedWorkItems) {
      const key = item.parent_work_item_id ?? ''
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(item)
    }
    return grouped
  }, [sortedWorkItems])

  const filteredAreas = useMemo(() => {
    return sortedAreas.filter((area) => {
      const areaPeopleText = areaPeople.filter((x) => x.area_id === area.id).map((x) => peopleMap.get(x.person_id)?.name ?? '').join(' ')
      const fnText = sortedFunctions.filter((x) => x.area_id === area.id).map((x) => `${x.name} ${x.description ?? ''} ${x.notes ?? ''}`).join(' ')
      return filterText(`${area.name} ${area.description ?? ''} ${area.notes ?? ''} ${areaPeopleText} ${fnText}`, search)
    })
  }, [sortedAreas, areaPeople, peopleMap, sortedFunctions, search])

  const filteredPeople = useMemo(() => people.filter((p) => filterText(`${p.name} ${p.email ?? ''} ${p.role_title ?? ''}`, search)), [people, search])
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const descendants = sortedWorkItems.filter((x) => findProject(x, workItemMap)?.id === project.id)
      const assignments = workItemPeople.filter((x) => descendants.some((d) => d.id === x.work_item_id)).map((x) => peopleMap.get(x.person_id)?.name ?? '').join(' ')
      const text = `${project.name} ${project.description ?? ''} ${descendants.map((x)=>x.name).join(' ')} ${assignments}`
      return filterText(text, search)
    })
  }, [projects, sortedWorkItems, workItemMap, workItemPeople, peopleMap, search])

  function areaLabel(areaId) { return areaMap.get(areaId)?.name ?? 'Sem área' }
  function functionLabel(fn) { return `${areaLabel(fn.area_id)}: ${fn.name}` }
  function workItemLabel(item) { return `${labelFor(itemTypes, item.type)}: ${item.name}` }
  function personName(personId) { return peopleMap.get(personId)?.name ?? '' }

  function deleteLabel(table, id) {
    if (table === 'people') return peopleMap.get(id)?.name ?? id
    if (table === 'areas') return areaMap.get(id)?.name ?? id
    if (table === 'functions') return functionMap.get(id) ? `Função: ${functionMap.get(id).name}` : id
    if (table === 'work_items') return workItemMap.get(id) ? workItemLabel(workItemMap.get(id)) : id
    if (table === 'area_people') {
      const row = areaPeople.find((x) => x.id === id)
      return row ? `${areaLabel(row.area_id)} → ${personName(row.person_id)}` : id
    }
    if (table === 'function_people') {
      const row = functionPeople.find((x) => x.id === id)
      return row ? `${functionLabel(functionMap.get(row.function_id))} → ${personName(row.person_id)}` : id
    }
    if (table === 'work_item_people') {
      const row = workItemPeople.find((x) => x.id === id)
      return row ? `${workItemLabel(workItemMap.get(row.work_item_id))} → ${personName(row.person_id)}` : id
    }
    if (table === 'work_item_dependencies') {
      const row = dependencies.find((x) => x.id === id)
      if (!row) return id
      return `${workItemMap.get(row.predecessor_work_item_id)?.name ?? 'Sem origem'} → ${workItemMap.get(row.successor_work_item_id)?.name ?? 'Sem destino'}`
    }
    return id
  }

  async function removeRow(table, id) {
    if (!id) return
    const ok = window.confirm(`Tens a certeza que queres apagar “${deleteLabel(table, id)}”?`)
    if (!ok) return
    clearFeedback()
    setSaving(true)
    const res = await supabase.from(table).delete().eq('id', id)
    setSaving(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    setMessage('Registo apagado com sucesso.')
    await loadAll()
  }

  async function saveRow(table, form, payload, successMessage) {
    clearFeedback()
    setSaving(true)
    const res = form.id ? await supabase.from(table).update(payload).eq('id', form.id) : await supabase.from(table).insert(payload)
    setSaving(false)
    if (res.error) {
      setError(res.error.message)
      return false
    }
    setMessage(successMessage)
    await loadAll()
    return true
  }

  function closeAreaEditing() {
    setAreaForm(null)
    setAreaAssignmentForm(null)
    setFunctionForm(null)
    setFunctionAssignmentForm(null)
  }
  function closeProjectEditing() {
    setProjectForm(null)
    setTaskForm(null)
    setWorkItemAssignmentForm(null)
    setDependencyForm(null)
  }

  function createArea() {
    setSelectedAreaId('')
    setAreaForm(emptyArea())
    scrollToEditor(editorRef)
  }
  function editArea(area) {
    setSelectedAreaId(area.id)
    setAreaForm({ ...area, notes: area.notes ?? '' })
    scrollToEditor(editorRef)
  }
  function createFunction(areaId, parentId = '') {
    setSelectedAreaId(areaId)
    setSelectedFunctionId('')
    setFunctionForm(emptyFunction(areaId, parentId))
    if (!expandedAreaIds.includes(areaId)) setExpandedAreaIds((p) => [...p, areaId])
    scrollToEditor(editorRef)
  }
  function editFunction(fn) {
    setSelectedAreaId(fn.area_id)
    setSelectedFunctionId(fn.id)
    setFunctionForm({ ...fn, notes: fn.notes ?? '' })
    scrollToEditor(editorRef)
  }
  function createAreaAssignment(areaId) {
    setSelectedAreaId(areaId)
    setSelectedAreaAssignmentId('')
    setAreaAssignmentForm(emptyAreaAssignment(areaId))
    scrollToEditor(editorRef)
  }
  function editAreaAssignment(row) {
    setSelectedAreaAssignmentId(row.id)
    setAreaAssignmentForm({ ...row })
    scrollToEditor(editorRef)
  }
  function createFunctionAssignment(functionId) {
    setSelectedFunctionAssignmentId('')
    setFunctionAssignmentForm(emptyFunctionAssignment(functionId))
    scrollToEditor(editorRef)
  }
  function editFunctionAssignment(row) {
    setSelectedFunctionAssignmentId(row.id)
    setFunctionAssignmentForm({ ...row })
    scrollToEditor(editorRef)
  }
  function createPerson() {
    setSelectedPersonId('')
    setPersonForm(emptyPerson())
    scrollToEditor(editorRef)
  }
  function editPerson(person) {
    setSelectedPersonId(person.id)
    setPersonForm({ ...person })
    scrollToEditor(editorRef)
  }
  function createProject() {
    setSelectedProjectId('')
    setSelectedWorkItemId('')
    setProjectForm(emptyProject())
    setTaskForm(null)
    scrollToEditor(taskEditorRef)
  }
  function editProject(project) {
    setSelectedProjectId(project.id)
    setSelectedWorkItemId(project.id)
    setProjectForm({ ...project })
    setTaskForm(null)
    if (!expandedProjectIds.includes(project.id)) setExpandedProjectIds((p) => [...p, project.id])
    scrollToEditor(taskEditorRef)
  }
  function createTask(projectId, parentId = '', type = 'task') {
    setSelectedProjectId(projectId)
    setSelectedWorkItemId('')
    setProjectForm(null)
    setTaskForm(emptyTask(parentId || projectId, type))
    scrollToEditor(taskEditorRef)
  }
  function editTask(task) {
    const projectId = findProject(task, workItemMap)?.id ?? ''
    setSelectedProjectId(projectId)
    setSelectedWorkItemId(task.id)
    setTaskForm({ ...task })
    setProjectForm(null)
    scrollToEditor(taskEditorRef)
  }
  function createTaskAssignment(workItemId) {
    setSelectedWorkItemAssignmentId('')
    setWorkItemAssignmentForm(emptyWorkItemAssignment(workItemId))
    scrollToEditor(taskEditorRef)
  }
  function editTaskAssignment(row) {
    setSelectedWorkItemAssignmentId(row.id)
    setWorkItemAssignmentForm({ ...row })
    scrollToEditor(taskEditorRef)
  }
  function createIncomingDependency(taskId) {
    setSelectedDependencyId('')
    setDependencyForm(emptyDependency('', taskId))
    scrollToEditor(taskEditorRef)
  }
  function createOutgoingDependency(taskId) {
    setSelectedDependencyId('')
    setDependencyForm(emptyDependency(taskId, ''))
    scrollToEditor(taskEditorRef)
  }
  function editDependency(dep) {
    setSelectedDependencyId(dep.id)
    setDependencyForm({ ...dep, note: dep.note ?? '' })
    scrollToEditor(taskEditorRef)
  }

  async function saveArea() {
    if (!areaForm?.name?.trim()) return setError('O nome da área é obrigatório.')
    const payload = {
      name: areaForm.name,
      description: areaForm.description || null,
      notes: areaForm.notes || null,
      status: areaForm.status,
      sort_order: areaForm.id ? areaForm.sort_order ?? 0 : (sortedAreas.at(-1)?.sort_order ?? 0) + 1,
    }
    const ok = await saveRow('areas', areaForm, payload, 'Área gravada com sucesso.')
    if (ok) closeAreaEditing()
  }
  async function saveFunction() {
    if (!functionForm?.area_id) return setError('Escolhe uma área.')
    if (!functionForm?.name?.trim()) return setError('O nome é obrigatório.')
    const siblings = sortedFunctions.filter((x) => x.area_id === functionForm.area_id && (x.parent_function_id ?? '') === (functionForm.parent_function_id ?? '') && x.id !== functionForm.id)
    const payload = {
      area_id: functionForm.area_id,
      parent_function_id: functionForm.parent_function_id || null,
      name: functionForm.name,
      description: functionForm.description || null,
      notes: functionForm.notes || null,
      status: functionForm.status,
      level: functionForm.parent_function_id ? 2 : 1,
      sort_order: functionForm.id ? functionForm.sort_order ?? 0 : (siblings.at(-1)?.sort_order ?? 0) + 1,
    }
    const ok = await saveRow('functions', functionForm, payload, 'Função gravada com sucesso.')
    if (ok) {
      setSelectedFunctionId('')
      setFunctionForm(null)
      setFunctionAssignmentForm(null)
    }
  }
  async function savePerson() {
    if (!personForm?.name?.trim()) return setError('O nome é obrigatório.')
    const ok = await saveRow('people', personForm, {
      name: personForm.name,
      email: personForm.email || null,
      role_title: personForm.role_title || null,
      status: personForm.status,
    }, 'Pessoa gravada com sucesso.')
    if (ok) setPersonForm(null)
  }
  async function saveProject() {
    if (!projectForm?.name?.trim()) return setError('O nome do projeto é obrigatório.')
    const payload = {
      parent_work_item_id: null,
      type: 'project',
      name: projectForm.name,
      description: projectForm.description || null,
      status: projectForm.status,
      phase: projectForm.phase,
      priority: projectForm.priority,
      sort_order: projectForm.id ? projectForm.sort_order ?? 0 : (projects.at(-1)?.sort_order ?? 0) + 1,
    }
    const ok = await saveRow('work_items', projectForm, payload, 'Projeto gravado com sucesso.')
    if (ok) closeProjectEditing()
  }
  async function saveTask() {
    if (!taskForm?.name?.trim()) return setError('O nome da tarefa é obrigatório.')
    const siblings = sortedWorkItems.filter((x) => (x.parent_work_item_id ?? '') === (taskForm.parent_work_item_id ?? '') && x.id !== taskForm.id)
    const payload = {
      parent_work_item_id: taskForm.parent_work_item_id || null,
      type: taskForm.type,
      name: taskForm.name,
      description: taskForm.description || null,
      status: taskForm.status,
      phase: taskForm.phase,
      priority: taskForm.priority,
      sort_order: taskForm.id ? taskForm.sort_order ?? 0 : (siblings.at(-1)?.sort_order ?? 0) + 1,
    }
    const ok = await saveRow('work_items', taskForm, payload, 'Tarefa gravada com sucesso.')
    if (ok) {
      setSelectedWorkItemId('')
      setTaskForm(null)
      setWorkItemAssignmentForm(null)
      setDependencyForm(null)
    }
  }
  async function saveAreaAssignment() {
    if (!areaAssignmentForm?.area_id || !areaAssignmentForm?.person_id) return setError('Escolhe área e pessoa.')
    const ok = await saveRow('area_people', areaAssignmentForm, {
      area_id: areaAssignmentForm.area_id,
      person_id: areaAssignmentForm.person_id,
      assignment_role: areaAssignmentForm.assignment_role,
      is_primary: areaAssignmentForm.is_primary,
    }, 'Responsável da área gravado com sucesso.')
    if (ok) setAreaAssignmentForm(null)
  }
  async function saveFunctionAssignment() {
    if (!functionAssignmentForm?.function_id || !functionAssignmentForm?.person_id) return setError('Escolhe função e pessoa.')
    const ok = await saveRow('function_people', functionAssignmentForm, {
      function_id: functionAssignmentForm.function_id,
      person_id: functionAssignmentForm.person_id,
      assignment_role: functionAssignmentForm.assignment_role,
      is_primary: functionAssignmentForm.is_primary,
    }, 'Responsável da função gravado com sucesso.')
    if (ok) setFunctionAssignmentForm(null)
  }
  async function saveWorkItemAssignment() {
    if (!workItemAssignmentForm?.work_item_id || !workItemAssignmentForm?.person_id) return setError('Escolhe tarefa e pessoa.')
    const ok = await saveRow('work_item_people', workItemAssignmentForm, {
      work_item_id: workItemAssignmentForm.work_item_id,
      person_id: workItemAssignmentForm.person_id,
      assignment_role: workItemAssignmentForm.assignment_role,
      is_primary: workItemAssignmentForm.is_primary,
    }, 'Responsável do item gravado com sucesso.')
    if (ok) setWorkItemAssignmentForm(null)
  }
  async function saveDependency() {
    if (!dependencyForm?.predecessor_work_item_id || !dependencyForm?.successor_work_item_id) return setError('Escolhe tarefa origem e tarefa destino.')
    if (dependencyForm.predecessor_work_item_id === dependencyForm.successor_work_item_id) return setError('Origem e destino não podem ser a mesma tarefa.')
    const ok = await saveRow('work_item_dependencies', dependencyForm, {
      predecessor_work_item_id: dependencyForm.predecessor_work_item_id,
      successor_work_item_id: dependencyForm.successor_work_item_id,
      dependency_type: dependencyForm.dependency_type,
      lag_days: Number(dependencyForm.lag_days) || 0,
      note: dependencyForm.note || null,
    }, 'Dependência gravada com sucesso.')
    if (ok) setDependencyForm(null)
  }

  function startDrag(type, draggedId, scope) { setDragState({ type, draggedId, scope, overId: '' }) }
  function dragEnter(overId) { setDragState((p) => ({ ...p, overId })) }
  function clearDrag() { setDragState({ type: '', draggedId: '', scope: '', overId: '' }) }

  async function dropArea(overId) {
    if (dragState.type !== 'area' || !dragState.draggedId || dragState.draggedId === overId) return clearDrag()
    try {
      setSaving(true); clearFeedback()
      await persistSortOrder('areas', reorderList(filteredAreas, dragState.draggedId, overId))
      await loadAll(); setMessage('Ordem das áreas atualizada.')
    } catch (err) { setError(err.message) } finally { setSaving(false); clearDrag() }
  }
  async function dropFunction(overId, scope) {
    if (dragState.type !== 'function' || dragState.scope !== scope || !dragState.draggedId || dragState.draggedId === overId) return clearDrag()
    try {
      setSaving(true); clearFeedback()
      const siblings = functionsByAreaParent.get(scope) ?? []
      await persistSortOrder('functions', reorderList(siblings, dragState.draggedId, overId))
      await loadAll(); setMessage('Ordem das funções atualizada.')
    } catch (err) { setError(err.message) } finally { setSaving(false); clearDrag() }
  }
  async function dropWorkItem(overId, scope) {
    if (dragState.type !== 'work_item' || dragState.scope !== scope || !dragState.draggedId || dragState.draggedId === overId) return clearDrag()
    try {
      setSaving(true); clearFeedback()
      const siblings = workItemsByParent.get(scope) ?? []
      await persistSortOrder('work_items', reorderList(siblings, dragState.draggedId, overId))
      await loadAll(); setMessage('Ordem dos itens atualizada.')
    } catch (err) { setError(err.message) } finally { setSaving(false); clearDrag() }
  }

  function renderFunctionTree(areaId, parentId = '', depth = 0) {
    const scope = `${areaId}::${parentId}`
    const items = functionsByAreaParent.get(scope) ?? []
    if (!items.length) return null
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map((fn) => (
          <div key={fn.id}>
            <div
              draggable
              onDragStart={() => startDrag('function', fn.id, scope)}
              onDragEnter={() => dragEnter(fn.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropFunction(fn.id, scope)}
              onDragEnd={clearDrag}
              style={{
                display: 'grid',
                gridTemplateColumns: '26px 1fr auto',
                gap: 6,
                marginLeft: depth * 18,
                alignItems: 'start',
                padding: 8,
                border: '1px solid #e3eadf',
                borderRadius: 8,
                background: dragState.overId === fn.id && dragState.type === 'function' ? '#eef6e8' : '#fff',
              }}
            >
              <div style={dragHandleStyle}>⋮⋮</div>
              <button style={{ ...(selectedFunctionId === fn.id ? primaryButtonStyle : buttonStyle), textAlign: 'left' }} onClick={() => editFunction(fn)}>{fn.name}</button>
              <button style={buttonStyle} onClick={() => createFunction(areaId, fn.id)}>+ Sub</button>
            </div>
            <div style={{ marginTop: 6 }}>{renderFunctionTree(areaId, fn.id, depth + 1)}</div>
          </div>
        ))}
      </div>
    )
  }

  function buildProjectTree(projectId, parentId = projectId, depth = 0) {
    const scope = parentId || ''
    const items = workItemsByParent.get(scope) ?? []
    if (!items.length) return null
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map((item) => {
          if (item.id === projectId && depth > 0) return null
          if (depth === 0 && item.type === 'project' && item.id !== projectId) return null
          const scopeValue = item.parent_work_item_id ?? ''
          return (
            <div key={item.id}>
              <div
                draggable={item.type !== 'project'}
                onDragStart={() => item.type !== 'project' && startDrag('work_item', item.id, scopeValue)}
                onDragEnter={() => item.type !== 'project' && dragEnter(item.id)}
                onDragOver={(e) => item.type !== 'project' && e.preventDefault()}
                onDrop={() => item.type !== 'project' && dropWorkItem(item.id, scopeValue)}
                onDragEnd={clearDrag}
                style={{
                  display: 'grid',
                  gridTemplateColumns: item.type !== 'project' ? '26px 1fr auto' : '1fr auto',
                  gap: 6,
                  marginLeft: depth * 18,
                  alignItems: 'start',
                  padding: 8,
                  border: '1px solid #e3eadf',
                  borderRadius: 8,
                  background: dragState.overId === item.id && dragState.type === 'work_item' ? '#eef6e8' : '#fff',
                }}
              >
                {item.type !== 'project' ? <div style={dragHandleStyle}>⋮⋮</div> : null}
                <button style={{ ...(selectedWorkItemId === item.id ? primaryButtonStyle : buttonStyle), textAlign: 'left' }} onClick={() => item.type === 'project' ? editProject(item) : editTask(item)}>{workItemLabel(item)}</button>
                <button style={buttonStyle} onClick={() => createTask(projectId, item.id, item.type === 'subtask' ? 'subtask' : 'subtask')}>+ Sub</button>
              </div>
              <div style={{ marginTop: 6 }}>{buildProjectTree(projectId, item.id, depth + 1)}</div>
            </div>
          )
        })}
      </div>
    )
  }

  const selectedAreaAssignments = areaPeople.filter((x) => x.area_id === selectedAreaId)
  const selectedAreaFunctions = sortedFunctions.filter((x) => x.area_id === selectedAreaId)
  const selectedFunctionAssignments = functionPeople.filter((x) => x.function_id === selectedFunctionId)
  const selectedTaskAssignments = workItemPeople.filter((x) => x.work_item_id === selectedWorkItemId)
  const incomingDependencies = dependencies.filter((x) => x.successor_work_item_id === selectedWorkItemId)
  const outgoingDependencies = dependencies.filter((x) => x.predecessor_work_item_id === selectedWorkItemId)
  const selectedTaskProjectId = selectedWorkItemId ? (findProject(workItemMap.get(selectedWorkItemId), workItemMap)?.id ?? '') : ''
  const dependencySourceCandidates = sortedWorkItems.filter((x) => x.type !== 'project' && (!selectedTaskProjectId || true))
  const dependencyTargetCandidates = sortedWorkItems.filter((x) => x.type !== 'project' && (!selectedTaskProjectId || true))

  function renderAreasTab() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div style={boxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <strong>Áreas</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setExpandedAreaIds(filteredAreas.map((x) => x.id))} style={buttonStyle}>+</button>
              <button onClick={() => setExpandedAreaIds([])} style={buttonStyle}>−</button>
              <button onClick={createArea} style={primaryButtonStyle}>+ Criar</button>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {filteredAreas.map((area) => {
              const isOpen = expandedAreaIds.includes(area.id)
              const isDrag = dragState.overId === area.id && dragState.type === 'area'
              return (
                <div
                  key={area.id}
                  draggable
                  onDragStart={() => startDrag('area', area.id, 'areas')}
                  onDragEnter={() => dragEnter(area.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropArea(area.id)}
                  onDragEnd={clearDrag}
                  style={{ ...subtleBoxStyle, background: isDrag ? '#eef6e8' : subtleBoxStyle.background }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto auto', gap: 6, alignItems: 'start' }}>
                    <div style={dragHandleStyle}>⋮⋮</div>
                    <button style={{ ...(selectedAreaId === area.id ? primaryButtonStyle : buttonStyle), textAlign: 'left' }} onClick={() => editArea(area)}>{area.name}</button>
                    <button style={buttonStyle} onClick={() => setExpandedAreaIds((prev) => prev.includes(area.id) ? prev.filter((x)=>x!==area.id) : [...prev, area.id])}>{isOpen ? '−' : '+'}</button>
                    <button style={buttonStyle} onClick={() => createFunction(area.id)}>+ Função</button>
                  </div>
                  {isOpen ? <div style={{ marginTop: 8 }}>{renderFunctionTree(area.id)}</div> : null}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }} ref={editorRef}>
          {areaForm ? (
            <div style={boxStyle}>
              <div style={{ display: 'grid', gap: 10 }}>
                <label>Nome<input style={inputStyle} value={areaForm.name} onChange={(e)=>setAreaForm((s)=>({...s,name:e.target.value}))} /></label>
                <label>Descrição<textarea style={{ ...inputStyle, minHeight: 80 }} value={areaForm.description ?? ''} onChange={(e)=>setAreaForm((s)=>({...s,description:e.target.value}))} /></label>
                <label>Notas<textarea style={{ ...inputStyle, minHeight: 80 }} value={areaForm.notes ?? ''} onChange={(e)=>setAreaForm((s)=>({...s,notes:e.target.value}))} /></label>
                <label>Estado<select style={inputStyle} value={areaForm.status} onChange={(e)=>setAreaForm((s)=>({...s,status:e.target.value}))}><option value="active">active</option><option value="inactive">inactive</option><option value="archived">archived</option></select></label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button style={primaryButtonStyle} onClick={saveArea}>Gravar área</button>
                  <button style={buttonStyle} onClick={closeAreaEditing}>Cancelar</button>
                  {areaForm.id ? <button style={dangerButtonStyle} onClick={()=>removeRow('areas', areaForm.id)}>Apagar</button> : null}
                </div>
              </div>
            </div>
          ) : null}

          {selectedAreaId ? (
            <div style={boxStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <strong>Responsáveis da área</strong>
                <button style={primaryButtonStyle} onClick={() => createAreaAssignment(selectedAreaId)}>+ Adicionar</button>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {selectedAreaAssignments.map((row) => (
                  <button key={row.id} style={{ ...(selectedAreaAssignmentId===row.id?primaryButtonStyle:buttonStyle), textAlign:'left' }} onClick={() => editAreaAssignment(row)}>{personName(row.person_id)} · {labelFor(areaRoles, row.assignment_role)}</button>
                ))}
                {!selectedAreaAssignments.length ? <div style={{ fontSize: 12, color: '#5f6f66' }}>Sem responsáveis atribuídos.</div> : null}
              </div>
              {areaAssignmentForm && areaAssignmentForm.area_id === selectedAreaId ? (
                <div style={{ display:'grid', gap:8, marginTop:10 }}>
                  <label>Pessoa<select style={inputStyle} value={areaAssignmentForm.person_id} onChange={(e)=>setAreaAssignmentForm((s)=>({...s,person_id:e.target.value}))}><option value="">Escolher</option>{people.map((person)=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
                  <label>Papel<select style={inputStyle} value={areaAssignmentForm.assignment_role} onChange={(e)=>setAreaAssignmentForm((s)=>({...s,assignment_role:e.target.value}))}>{areaRoles.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
                  <label style={{ display:'flex', gap:8, alignItems:'center' }}><input type="checkbox" checked={!!areaAssignmentForm.is_primary} onChange={(e)=>setAreaAssignmentForm((s)=>({...s,is_primary:e.target.checked}))} />Principal</label>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button style={primaryButtonStyle} onClick={saveAreaAssignment}>Gravar responsável</button>
                    <button style={buttonStyle} onClick={()=>setAreaAssignmentForm(null)}>Cancelar</button>
                    {areaAssignmentForm.id ? <button style={dangerButtonStyle} onClick={()=>removeRow('area_people', areaAssignmentForm.id)}>Apagar</button> : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {selectedAreaId ? (
            <div style={boxStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <strong>Funções e subfunções da área</strong>
                <button style={primaryButtonStyle} onClick={() => createFunction(selectedAreaId)}>+ Nova função</button>
              </div>
              {selectedAreaFunctions.length ? renderFunctionTree(selectedAreaId) : <div style={{ fontSize:12, color:'#5f6f66' }}>Sem funções nesta área.</div>}
            </div>
          ) : null}

          {functionForm && functionForm.area_id === selectedAreaId ? (
            <div style={boxStyle}>
              <div style={{ display:'grid', gap:10 }}>
                <label>Função mãe<select style={inputStyle} value={functionForm.parent_function_id ?? ''} onChange={(e)=>setFunctionForm((s)=>({...s,parent_function_id:e.target.value}))}><option value="">Nenhuma</option>{selectedAreaFunctions.filter((fn)=>fn.id!==functionForm.id).map((fn)=><option key={fn.id} value={fn.id}>{fn.name}</option>)}</select></label>
                <label>Nome<input style={inputStyle} value={functionForm.name} onChange={(e)=>setFunctionForm((s)=>({...s,name:e.target.value}))} /></label>
                <label>Descrição<textarea style={{ ...inputStyle, minHeight:80 }} value={functionForm.description ?? ''} onChange={(e)=>setFunctionForm((s)=>({...s,description:e.target.value}))} /></label>
                <label>Notas<textarea style={{ ...inputStyle, minHeight:80 }} value={functionForm.notes ?? ''} onChange={(e)=>setFunctionForm((s)=>({...s,notes:e.target.value}))} /></label>
                <label>Estado<select style={inputStyle} value={functionForm.status} onChange={(e)=>setFunctionForm((s)=>({...s,status:e.target.value}))}><option value="active">active</option><option value="inactive">inactive</option><option value="archived">archived</option></select></label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button style={primaryButtonStyle} onClick={saveFunction}>Gravar função</button>
                  <button style={buttonStyle} onClick={()=>{setFunctionForm(null);setFunctionAssignmentForm(null)}}>Cancelar</button>
                  {functionForm.id ? <button style={dangerButtonStyle} onClick={()=>removeRow('functions', functionForm.id)}>Apagar</button> : null}
                </div>
              </div>

              {functionForm.id ? (
                <div style={{ ...subtleBoxStyle, marginTop:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:8 }}>
                    <strong style={{ fontSize:13 }}>Responsáveis da função</strong>
                    <button style={primaryButtonStyle} onClick={()=>createFunctionAssignment(functionForm.id)}>+ Adicionar</button>
                  </div>
                  <div style={{ display:'grid', gap:6 }}>
                    {selectedFunctionAssignments.map((row)=>(
                      <button key={row.id} style={{ ...(selectedFunctionAssignmentId===row.id?primaryButtonStyle:buttonStyle), textAlign:'left' }} onClick={()=>editFunctionAssignment(row)}>{personName(row.person_id)} · {labelFor(genericRoles, row.assignment_role)}</button>
                    ))}
                    {!selectedFunctionAssignments.length ? <div style={{ fontSize:12, color:'#5f6f66' }}>Sem responsáveis atribuídos.</div> : null}
                  </div>
                  {functionAssignmentForm && functionAssignmentForm.function_id === functionForm.id ? (
                    <div style={{ display:'grid', gap:8, marginTop:10 }}>
                      <label>Pessoa<select style={inputStyle} value={functionAssignmentForm.person_id} onChange={(e)=>setFunctionAssignmentForm((s)=>({...s,person_id:e.target.value}))}><option value="">Escolher</option>{people.map((person)=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
                      <label>Papel<select style={inputStyle} value={functionAssignmentForm.assignment_role} onChange={(e)=>setFunctionAssignmentForm((s)=>({...s,assignment_role:e.target.value}))}>{genericRoles.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
                      <label style={{ display:'flex', gap:8, alignItems:'center' }}><input type="checkbox" checked={!!functionAssignmentForm.is_primary} onChange={(e)=>setFunctionAssignmentForm((s)=>({...s,is_primary:e.target.checked}))} />Principal</label>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <button style={primaryButtonStyle} onClick={saveFunctionAssignment}>Gravar responsável</button>
                        <button style={buttonStyle} onClick={()=>setFunctionAssignmentForm(null)}>Cancelar</button>
                        {functionAssignmentForm.id ? <button style={dangerButtonStyle} onClick={()=>removeRow('function_people', functionAssignmentForm.id)}>Apagar</button> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  function renderPeopleTab() {
    return (
      <div style={{ display:'grid', gridTemplateColumns:'320px minmax(0,1fr)', gap:16, alignItems:'start' }}>
        <div style={boxStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:10 }}>
            <strong>Pessoas</strong>
            <button onClick={createPerson} style={primaryButtonStyle}>+ Criar</button>
          </div>
          <div style={{ display:'grid', gap:6 }}>
            {filteredPeople.map((person)=>(
              <button key={person.id} style={{ ...(selectedPersonId===person.id?primaryButtonStyle:buttonStyle), textAlign:'left' }} onClick={()=>editPerson(person)}>{person.name}</button>
            ))}
          </div>
        </div>
        <div style={boxStyle} ref={editorRef}>
          {personForm ? (
            <div style={{ display:'grid', gap:10 }}>
              <label>Nome<input style={inputStyle} value={personForm.name} onChange={(e)=>setPersonForm((s)=>({...s,name:e.target.value}))} /></label>
              <label>Email<input style={inputStyle} value={personForm.email ?? ''} onChange={(e)=>setPersonForm((s)=>({...s,email:e.target.value}))} /></label>
              <label>Cargo / título<input style={inputStyle} value={personForm.role_title ?? ''} onChange={(e)=>setPersonForm((s)=>({...s,role_title:e.target.value}))} /></label>
              <label>Estado<select style={inputStyle} value={personForm.status} onChange={(e)=>setPersonForm((s)=>({...s,status:e.target.value}))}><option value="active">active</option><option value="inactive">inactive</option></select></label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button style={primaryButtonStyle} onClick={savePerson}>Gravar</button>
                <button style={buttonStyle} onClick={()=>setPersonForm(null)}>Cancelar</button>
                {personForm.id ? <button style={dangerButtonStyle} onClick={()=>removeRow('people', personForm.id)}>Apagar</button> : null}
              </div>
            </div>
          ) : <div>Escolhe uma pessoa à esquerda.</div>}
        </div>
      </div>
    )
  }

  function renderProjectsTab() {
    return (
      <div style={{ display:'grid', gridTemplateColumns:'360px minmax(0,1fr)', gap:16, alignItems:'start' }}>
        <div style={boxStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:10 }}>
            <strong>Projetos</strong>
            <div style={{ display:'flex', gap:8 }}>
              <button style={buttonStyle} onClick={()=>setExpandedProjectIds(filteredProjects.map((x)=>x.id))}>+</button>
              <button style={buttonStyle} onClick={()=>setExpandedProjectIds([])}>−</button>
              <button style={primaryButtonStyle} onClick={createProject}>+ Criar projeto</button>
            </div>
          </div>
          <div style={{ display:'grid', gap:8 }}>
            {filteredProjects.map((project)=>{
              const isOpen = expandedProjectIds.includes(project.id)
              return (
                <div key={project.id} style={subtleBoxStyle}>
                  <div style={{ display:'flex', gap:6, alignItems:'start' }}>
                    <button style={{ ...(selectedProjectId===project.id?primaryButtonStyle:buttonStyle), flex:1, textAlign:'left' }} onClick={()=>editProject(project)}>{project.name}</button>
                    <button style={buttonStyle} onClick={()=>setExpandedProjectIds((prev)=>prev.includes(project.id)?prev.filter((x)=>x!==project.id):[...prev, project.id])}>{isOpen ? '−' : '+'}</button>
                    <button style={buttonStyle} onClick={()=>createTask(project.id, project.id, 'task')}>+ Tarefa</button>
                  </div>
                  {isOpen ? <div style={{ marginTop:8 }}>{buildProjectTree(project.id)}</div> : null}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display:'grid', gap:16 }} ref={taskEditorRef}>
          {projectForm ? (
            <div style={boxStyle}>
              <div style={{ display:'grid', gap:10 }}>
                <label>Nome<input style={inputStyle} value={projectForm.name} onChange={(e)=>setProjectForm((s)=>({...s,name:e.target.value}))} /></label>
                <label>Descrição<textarea style={{ ...inputStyle, minHeight:90 }} value={projectForm.description ?? ''} onChange={(e)=>setProjectForm((s)=>({...s,description:e.target.value}))} /></label>
                <label>Estado<select style={inputStyle} value={projectForm.status} onChange={(e)=>setProjectForm((s)=>({...s,status:e.target.value}))}>{workStatuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                <label>Fase<select style={inputStyle} value={projectForm.phase} onChange={(e)=>setProjectForm((s)=>({...s,phase:e.target.value}))}>{phases.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                <label>Prioridade<select style={inputStyle} value={projectForm.priority} onChange={(e)=>setProjectForm((s)=>({...s,priority:e.target.value}))}>{priorities.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button style={primaryButtonStyle} onClick={saveProject}>Gravar projeto</button>
                  <button style={buttonStyle} onClick={closeProjectEditing}>Cancelar</button>
                  {projectForm.id ? <button style={dangerButtonStyle} onClick={()=>removeRow('work_items', projectForm.id)}>Apagar</button> : null}
                </div>
              </div>

              {projectForm.id ? (
                <div style={{ ...subtleBoxStyle, marginTop:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:8 }}>
                    <strong style={{ fontSize:13 }}>Responsáveis deste projeto</strong>
                    <button style={primaryButtonStyle} onClick={()=>createTaskAssignment(projectForm.id)}>+ Adicionar</button>
                  </div>
                  <div style={{ display:'grid', gap:6 }}>
                    {workItemPeople.filter((x)=>x.work_item_id===projectForm.id).map((row)=>(
                      <button key={row.id} style={{ ...(selectedWorkItemAssignmentId===row.id?primaryButtonStyle:buttonStyle), textAlign:'left' }} onClick={()=>editTaskAssignment(row)}>{personName(row.person_id)} · {labelFor(genericRoles, row.assignment_role)}</button>
                    ))}
                    {!workItemPeople.filter((x)=>x.work_item_id===projectForm.id).length ? <div style={{ fontSize:12, color:'#5f6f66' }}>Sem responsáveis atribuídos.</div> : null}
                  </div>
                  {workItemAssignmentForm && workItemAssignmentForm.work_item_id === projectForm.id ? (
                    <div style={{ display:'grid', gap:8, marginTop:10 }}>
                      <label>Pessoa<select style={inputStyle} value={workItemAssignmentForm.person_id} onChange={(e)=>setWorkItemAssignmentForm((s)=>({...s,person_id:e.target.value}))}><option value="">Escolher</option>{people.map((person)=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
                      <label>Papel<select style={inputStyle} value={workItemAssignmentForm.assignment_role} onChange={(e)=>setWorkItemAssignmentForm((s)=>({...s,assignment_role:e.target.value}))}>{genericRoles.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                      <label style={{ display:'flex', gap:8, alignItems:'center' }}><input type="checkbox" checked={!!workItemAssignmentForm.is_primary} onChange={(e)=>setWorkItemAssignmentForm((s)=>({...s,is_primary:e.target.checked}))} />Principal</label>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <button style={primaryButtonStyle} onClick={saveWorkItemAssignment}>Gravar responsável</button>
                        <button style={buttonStyle} onClick={()=>setWorkItemAssignmentForm(null)}>Cancelar</button>
                        {workItemAssignmentForm.id ? <button style={dangerButtonStyle} onClick={()=>removeRow('work_item_people', workItemAssignmentForm.id)}>Apagar</button> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {taskForm ? (
            <div style={boxStyle}>
              <div style={{ display:'grid', gap:10 }}>
                <label>Tipo<select style={inputStyle} value={taskForm.type} onChange={(e)=>setTaskForm((s)=>({...s,type:e.target.value}))}>{itemTypes.filter(([value])=>value!=='project').map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                <label>Item pai<select style={inputStyle} value={taskForm.parent_work_item_id ?? ''} onChange={(e)=>setTaskForm((s)=>({...s,parent_work_item_id:e.target.value}))}><option value="">Nenhum</option>{sortedWorkItems.filter((x)=>x.id!==taskForm.id).map((item)=><option key={item.id} value={item.id}>{workItemLabel(item)}</option>)}</select></label>
                <label>Nome<input style={inputStyle} value={taskForm.name} onChange={(e)=>setTaskForm((s)=>({...s,name:e.target.value}))} /></label>
                <label>Descrição<textarea style={{ ...inputStyle, minHeight:90 }} value={taskForm.description ?? ''} onChange={(e)=>setTaskForm((s)=>({...s,description:e.target.value}))} /></label>
                <label>Estado<select style={inputStyle} value={taskForm.status} onChange={(e)=>setTaskForm((s)=>({...s,status:e.target.value}))}>{workStatuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                <label>Fase<select style={inputStyle} value={taskForm.phase} onChange={(e)=>setTaskForm((s)=>({...s,phase:e.target.value}))}>{phases.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                <label>Prioridade<select style={inputStyle} value={taskForm.priority} onChange={(e)=>setTaskForm((s)=>({...s,priority:e.target.value}))}>{priorities.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button style={primaryButtonStyle} onClick={saveTask}>Gravar tarefa</button>
                  <button style={buttonStyle} onClick={closeProjectEditing}>Cancelar</button>
                  {taskForm.id ? <button style={dangerButtonStyle} onClick={()=>removeRow('work_items', taskForm.id)}>Apagar</button> : null}
                </div>
              </div>

              {taskForm.id ? (
                <div style={{ ...subtleBoxStyle, marginTop:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:8 }}>
                    <strong style={{ fontSize:13 }}>Responsáveis desta tarefa</strong>
                    <button style={primaryButtonStyle} onClick={()=>createTaskAssignment(taskForm.id)}>+ Adicionar</button>
                  </div>
                  <div style={{ display:'grid', gap:6 }}>
                    {selectedTaskAssignments.map((row)=>(
                      <button key={row.id} style={{ ...(selectedWorkItemAssignmentId===row.id?primaryButtonStyle:buttonStyle), textAlign:'left' }} onClick={()=>editTaskAssignment(row)}>{personName(row.person_id)} · {labelFor(genericRoles, row.assignment_role)}</button>
                    ))}
                    {!selectedTaskAssignments.length ? <div style={{ fontSize:12, color:'#5f6f66' }}>Sem responsáveis atribuídos.</div> : null}
                  </div>
                  {workItemAssignmentForm && workItemAssignmentForm.work_item_id === taskForm.id ? (
                    <div style={{ display:'grid', gap:8, marginTop:10 }}>
                      <label>Pessoa<select style={inputStyle} value={workItemAssignmentForm.person_id} onChange={(e)=>setWorkItemAssignmentForm((s)=>({...s,person_id:e.target.value}))}><option value="">Escolher</option>{people.map((person)=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
                      <label>Papel<select style={inputStyle} value={workItemAssignmentForm.assignment_role} onChange={(e)=>setWorkItemAssignmentForm((s)=>({...s,assignment_role:e.target.value}))}>{genericRoles.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                      <label style={{ display:'flex', gap:8, alignItems:'center' }}><input type="checkbox" checked={!!workItemAssignmentForm.is_primary} onChange={(e)=>setWorkItemAssignmentForm((s)=>({...s,is_primary:e.target.checked}))} />Principal</label>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <button style={primaryButtonStyle} onClick={saveWorkItemAssignment}>Gravar responsável</button>
                        <button style={buttonStyle} onClick={()=>setWorkItemAssignmentForm(null)}>Cancelar</button>
                        {workItemAssignmentForm.id ? <button style={dangerButtonStyle} onClick={()=>removeRow('work_item_people', workItemAssignmentForm.id)}>Apagar</button> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {taskForm.id ? (
                <div style={{ ...subtleBoxStyle, marginTop:12 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div style={{ display:'grid', gap:8 }}>
                      <button style={primaryButtonStyle} onClick={()=>createIncomingDependency(taskForm.id)}>+ Esta tarefa depende de...</button>
                      <strong style={{ fontSize:12 }}>O que bloqueia a tarefa:</strong>
                      {incomingDependencies.map((dep)=>{
                        const pred = workItemMap.get(dep.predecessor_work_item_id)
                        return <button key={dep.id} style={{ ...(selectedDependencyId===dep.id?primaryButtonStyle:buttonStyle), textAlign:'left' }} onClick={()=>editDependency(dep)}>{dependencySentence(pred?.name ?? 'Sem origem', taskForm.name ?? 'Sem nome', dep.dependency_type)}</button>
                      })}
                      {!incomingDependencies.length ? <div style={{ fontSize:12, color:'#5f6f66' }}>Sem dependências de entrada.</div> : null}
                    </div>
                    <div style={{ display:'grid', gap:8 }}>
                      <button style={buttonStyle} onClick={()=>createOutgoingDependency(taskForm.id)}>+ Esta tarefa bloqueia...</button>
                      <strong style={{ fontSize:12 }}>O que esta tarefa bloqueia</strong>
                      {outgoingDependencies.map((dep)=>{
                        const succ = workItemMap.get(dep.successor_work_item_id)
                        const phrase = dependencySentence(taskForm.name ?? 'Sem nome', succ?.name ?? 'Sem destino', dep.dependency_type)
                          .replace(`[${succ?.name ?? 'Sem destino'}] é bloqueada por [${taskForm.name ?? 'Sem nome'}]`, `[${taskForm.name ?? 'Sem nome'}] bloqueia [${succ?.name ?? 'Sem destino'}]`)
                          .replace(' e só pode', ' e esta só pode')
                          .replace(' e depende de', ' e esta depende de')
                        return <button key={dep.id} style={{ ...(selectedDependencyId===dep.id?primaryButtonStyle:buttonStyle), textAlign:'left' }} onClick={()=>editDependency(dep)}>{phrase}</button>
                      })}
                      {!outgoingDependencies.length ? <div style={{ fontSize:12, color:'#5f6f66' }}>Sem dependências de saída.</div> : null}
                    </div>
                  </div>

                  {dependencyForm && (dependencyForm.predecessor_work_item_id === taskForm.id || dependencyForm.successor_work_item_id === taskForm.id) ? (
                    <div style={{ display:'grid', gap:10, marginTop:12 }}>
                      <label>Tarefa origem<select style={inputStyle} value={dependencyForm.predecessor_work_item_id} onChange={(e)=>setDependencyForm((s)=>({...s, predecessor_work_item_id:e.target.value}))}><option value="">Escolher</option>{dependencySourceCandidates.filter((x)=>x.id!==dependencyForm.successor_work_item_id).map((item)=><option key={item.id} value={item.id}>{workItemLabel(item)}</option>)}</select></label>
                      <label>Tarefa destino<select style={inputStyle} value={dependencyForm.successor_work_item_id} onChange={(e)=>setDependencyForm((s)=>({...s, successor_work_item_id:e.target.value}))}><option value="">Escolher</option>{dependencyTargetCandidates.filter((x)=>x.id!==dependencyForm.predecessor_work_item_id).map((item)=><option key={item.id} value={item.id}>{workItemLabel(item)}</option>)}</select></label>
                      <label>Tipo de dependência<select style={inputStyle} value={dependencyForm.dependency_type} onChange={(e)=>setDependencyForm((s)=>({...s, dependency_type:e.target.value}))}>{dependencyTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                      <label>Nota / explicação<textarea style={{ ...inputStyle, minHeight:80 }} value={dependencyForm.note ?? ''} onChange={(e)=>setDependencyForm((s)=>({...s, note:e.target.value}))} /></label>
                      <label>Lag em dias<input type="number" style={inputStyle} value={dependencyForm.lag_days ?? 0} onChange={(e)=>setDependencyForm((s)=>({...s, lag_days:e.target.value}))} /></label>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <button style={primaryButtonStyle} onClick={saveDependency}>Gravar dependência</button>
                        <button style={buttonStyle} onClick={()=>setDependencyForm(null)}>Cancelar</button>
                        {dependencyForm.id ? <button style={dangerButtonStyle} onClick={()=>removeRow('work_item_dependencies', dependencyForm.id)}>Apagar</button> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        :root { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:#1d2a21; background:#f6f8f4; }
        html, body, #root { margin:0; min-height:100%; width:100%; }
        body { background:#f6f8f4; color:#1d2a21; }
        * { box-sizing:border-box; }
        label { display:grid; gap:4px; font-size:12px; color:#46604d; }
        select, input, textarea, button { font:inherit; }
        textarea { resize:vertical; }
      `}</style>
      <div style={{ maxWidth: 1800, margin:'0 auto', padding:'24px 18px 40px' }}>
        <header style={{ marginBottom:18 }}>
          <img src="https://img.brainstormphda.pt/marca/logo/BPHDA_logo_pt_horizontal_verde.svg" alt="BPHDA" style={{ display:'block', height:34, width:'auto', marginBottom:14 }} />
          <h1 style={{ margin:0, fontSize:26, lineHeight:1.05, color:'#16361f' }}>Editor de dados</h1>
          <div style={{ marginTop:8, display:'flex', gap:8, flexWrap:'wrap' }}>
            <a href="/" style={{ ...buttonStyle, textDecoration:'none', display:'inline-block' }}>Voltar à vista principal</a>
            <button onClick={loadAll} style={buttonStyle}>Recarregar dados</button>
            <input style={{ ...inputStyle, width: 280 }} value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar no editor" />
          </div>
        </header>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          {[
            ['areas','Áreas'],
            ['projects','Projetos e tarefas'],
            ['people','Pessoas'],
          ].map(([key,label]) => (
            <button key={key} onClick={()=>setTab(key)} style={tab===key ? primaryButtonStyle : buttonStyle}>{label}</button>
          ))}
        </div>

        {loading ? <div style={boxStyle}>A carregar...</div> : null}
        {!loading && error ? <div style={{ ...boxStyle, background:'#fff4f4', borderColor:'#efcaca', color:'#8a2f2f', marginBottom:12 }}>{error}</div> : null}
        {!loading && message ? <div style={{ ...boxStyle, background:'#eef6e8', borderColor:'#cfe0c4', color:'#35513c', marginBottom:12 }}>{message}</div> : null}
        {!loading && !error ? (
          tab === 'areas' ? renderAreasTab() : tab === 'projects' ? renderProjectsTab() : renderPeopleTab()
        ) : null}
      </div>
    </>
  )
}

createRoot(document.getElementById('root')).render(<EditorApp />)
