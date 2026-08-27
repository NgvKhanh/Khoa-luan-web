import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import BoardList from '../components/board/BoardList';
import BoardCard from '../components/board/BoardCard';
import AddListForm from '../components/board/AddListForm';
import { colorForId } from '../lib/avatar';
import { getErrorMessage } from '../lib/errorMessage';
import {
  createList as apiCreateList,
  deleteList as apiDeleteList,
  fetchBoardLists,
  updateList as apiUpdateList,
} from '../lib/api/list';
import { createTask, moveTask } from '../lib/api/task';
import { fetchProjectDetail } from '../lib/api/project';
import type { BoardList as BoardListType } from '../types/list';
import type { ProjectDetail } from '../types/project';
import type { Task } from '../types/task';

// Bo tien to "list-" khoi id cua cot khi keo tha
function listIdFromDnd(id: string): string | null {
  return id.startsWith('list-') ? id.slice('list-'.length) : null;
}

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [lists, setLists] = useState<BoardListType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCard, setActiveCard] = useState<Task | null>(null);
  const [activeList, setActiveList] = useState<BoardListType | null>(null);

  const sensors = useSensors(
    // Phai keo qua 5px moi tinh la keo -> van bam vao the binh thuong duoc
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function loadBoard() {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [projectData, listData] = await Promise.all([
        fetchProjectDetail(projectId),
        fetchBoardLists(projectId),
      ]);
      setProject(projectData);
      setLists(listData);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được bảng.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const listDndIds = useMemo(() => lists.map((l) => `list-${l.id}`), [lists]);

  // Tim cot dang chua the co id cho truoc (theo state hien tai)
  function findListIdByCard(cardId: string): string | undefined {
    return lists.find((l) => l.tasks.some((t) => t.id === cardId))?.id;
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const type = active.data.current?.type;
    if (type === 'list') {
      const id = listIdFromDnd(active.id as string);
      setActiveList(lists.find((l) => l.id === id) ?? null);
    } else if (type === 'card') {
      const listId = findListIdByCard(active.id as string);
      const card = lists
        .find((l) => l.id === listId)
        ?.tasks.find((t) => t.id === active.id);
      setActiveCard(card ?? null);
    }
  }

  // Keo the qua cot khac: di chuyen ngay trong state de the "di theo" con tro
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.data.current?.type !== 'card') return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const fromListId = findListIdByCard(activeId);
    const toListId =
      over.data.current?.type === 'card'
        ? findListIdByCard(overId)
        : (listIdFromDnd(overId) ?? undefined);

    if (!fromListId || !toListId || fromListId === toListId) return;

    setLists((prev) => {
      const fromList = prev.find((l) => l.id === fromListId);
      const toList = prev.find((l) => l.id === toListId);
      if (!fromList || !toList) return prev;

      const moving = fromList.tasks.find((t) => t.id === activeId);
      if (!moving) return prev;

      const overIndex =
        over.data.current?.type === 'card'
          ? toList.tasks.findIndex((t) => t.id === overId)
          : toList.tasks.length;
      const insertAt = overIndex >= 0 ? overIndex : toList.tasks.length;

      return prev.map((l) => {
        if (l.id === fromListId) {
          return { ...l, tasks: l.tasks.filter((t) => t.id !== activeId) };
        }
        if (l.id === toListId) {
          const next = [...l.tasks];
          next.splice(insertAt, 0, { ...moving, listId: toListId });
          return { ...l, tasks: next };
        }
        return l;
      });
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const type = active.data.current?.type;
    setActiveCard(null);
    setActiveList(null);
    if (!over) return;

    // ---- Keo sap xep lai cot ----
    if (type === 'list') {
      const oldIndex = lists.findIndex((l) => `list-${l.id}` === active.id);
      const newIndex = lists.findIndex((l) => `list-${l.id}` === over.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(lists, oldIndex, newIndex);
      setLists(reordered);
      try {
        await apiUpdateList(reordered[newIndex]!.id, { position: newIndex });
      } catch (err) {
        setError(getErrorMessage(err, 'Không lưu được thứ tự danh sách.'));
        loadBoard();
      }
      return;
    }

    // ---- Keo tha the ----
    if (type === 'card') {
      const activeId = active.id as string;
      const overId = over.id as string;
      const toListId =
        over.data.current?.type === 'card'
          ? findListIdByCard(overId)
          : (listIdFromDnd(overId) ?? undefined);
      if (!toListId) return;

      const toList = lists.find((l) => l.id === toListId);
      if (!toList) return;

      const oldIndex = toList.tasks.findIndex((t) => t.id === activeId);
      const overIndex =
        over.data.current?.type === 'card'
          ? toList.tasks.findIndex((t) => t.id === overId)
          : toList.tasks.length - 1;
      const newIndex = overIndex >= 0 ? overIndex : toList.tasks.length - 1;

      let finalIndex = oldIndex;
      if (oldIndex !== -1 && oldIndex !== newIndex) {
        const reorderedTasks = arrayMove(toList.tasks, oldIndex, newIndex);
        finalIndex = reorderedTasks.findIndex((t) => t.id === activeId);
        setLists((prev) =>
          prev.map((l) =>
            l.id === toListId ? { ...l, tasks: reorderedTasks } : l
          )
        );
      } else if (oldIndex === -1) {
        // Truong hop hiem: state chua kip cap nhat -> tai lai cho chac
        finalIndex = toList.tasks.length;
      }

      try {
        await moveTask(activeId, { listId: toListId, position: finalIndex });
      } catch (err) {
        setError(getErrorMessage(err, 'Không di chuyển được thẻ.'));
        loadBoard();
      }
    }
  }

  // ----- Cac thao tac tren List/Task, cap nhat lac quan roi goi API -----

  async function handleAddCard(listId: string, title: string) {
    if (!projectId) return;
    const created = await createTask(projectId, { title, listId });
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId ? { ...l, tasks: [...l.tasks, created] } : l
      )
    );
  }

  async function handleRenameList(listId: string, name: string) {
    setLists((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, name } : l))
    );
    try {
      await apiUpdateList(listId, { name });
    } catch (err) {
      setError(getErrorMessage(err, 'Không đổi được tên danh sách.'));
      loadBoard();
      throw err;
    }
  }

  async function handleDeleteList(listId: string) {
    await apiDeleteList(listId);
    setLists((prev) => prev.filter((l) => l.id !== listId));
  }

  async function handleAddList(name: string) {
    if (!projectId) return;
    const created = await apiCreateList(projectId, name);
    setLists((prev) => [...prev, created]);
  }

  function handleOpenCard(taskId: string) {
    // Buoc sau se thay bang modal; tam thoi mo trang chi tiet
    window.location.assign(`/tasks/${taskId}`);
  }

  const boardColor = project ? colorForId(project.id) : '#0079BF';

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-slate-500">Đang tải bảng...</div>
    );
  }

  if (error && !project) {
    return <div className="p-4 text-sm text-red-600">{error}</div>;
  }

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      style={{ backgroundColor: boardColor }}
    >
      {/* Thanh tieu de bang */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-white">
        <h1 className="text-lg font-bold">{project?.name}</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link
            to={`/projects/${project?.id}`}
            className="rounded bg-white/20 px-2 py-1 hover:bg-white/30"
          >
            Thành viên
          </Link>
          <Link
            to={`/projects/${project?.id}/tasks`}
            className="rounded bg-white/20 px-2 py-1 hover:bg-white/30"
          >
            Danh sách công việc
          </Link>
        </div>
      </div>

      {error && (
        <p className="mx-4 mb-2 rounded bg-red-600/90 px-3 py-1 text-sm text-white">
          {error}
        </p>
      )}

      {/* Vung cac cot - cuon ngang */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="board-scroll flex flex-1 items-start gap-3 overflow-x-auto p-4 pt-1">
          <SortableContext
            items={listDndIds}
            strategy={horizontalListSortingStrategy}
          >
            {lists.map((list) => (
              <BoardList
                key={list.id}
                list={list}
                onAddCard={handleAddCard}
                onRenameList={handleRenameList}
                onDeleteList={handleDeleteList}
                onOpenCard={handleOpenCard}
              />
            ))}
          </SortableContext>

          <AddListForm onAdd={handleAddList} />
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="w-64 rotate-2">
              <BoardCard task={activeCard} onOpen={() => {}} />
            </div>
          ) : activeList ? (
            <div className="w-72 rounded-xl bg-slate-100 p-2 opacity-90 shadow-xl">
              <p className="px-1 text-sm font-semibold text-slate-700">
                {activeList.name}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
