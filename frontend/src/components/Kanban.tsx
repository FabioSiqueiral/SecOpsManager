"use client";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSSProperties } from "react";
import {
  Activity,
  Status,
  statuses,
  statusNames,
  statusColors,
  priorities,
} from "@/lib/types";
function Card({
  a,
  onOpen,
  disabled,
}: {
  a: Activity;
  onOpen: (a: Activity) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: a.id, disabled });
  const style: CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px,${transform.y}px,0)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <article ref={setNodeRef} style={style} className="task">
      <div className="task-meta">
        <span>{a.category}</span>
        <button
          className="drag-handle"
          {...listeners}
          {...attributes}
          aria-label={`Mover ${a.title}`}
          disabled={disabled}
        >
          ⠿
        </button>
      </div>
      <button className="task-title" onClick={() => onOpen(a)}>
        {a.title}
      </button>
      <p>{a.client}</p>
      <div className="task-tags">
        <span className={`priority ${a.priority}`}>
          {priorities[a.priority]}
        </span>
        {a.blocked && <span className="priority Critical">Bloqueada</span>}
      </div>
      <div className="task-footer">
        <span className="avatar" title={a.assignee}>
          {a.assignee
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")}
        </span>
        <span className={a.late ? "late" : ""}>
          {new Date(a.dueAt).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
          })}
        </span>
        <span>{a.actualHours.toFixed(1)}h</span>
      </div>
    </article>
  );
}
function Column({
  status,
  items,
  onOpen,
  disabled,
}: {
  status: Status;
  items: Activity[];
  onOpen: (a: Activity) => void;
  disabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={`kanban-column ${isOver ? "over" : ""}`}
    >
      <h3>
        <i style={{ background: statusColors[status] }} />
        {statusNames[status]} <span>{items.length}</span>
      </h3>
      {items.map((a) => (
        <Card key={a.id} a={a} onOpen={onOpen} disabled={disabled} />
      ))}
      {!items.length && <div className="empty-column">Nenhuma atividade</div>}
    </section>
  );
}
export default function Kanban({
  items,
  onOpen,
  onMove,
  disabled,
}: {
  items: Activity[];
  onOpen: (a: Activity) => void;
  onMove: (a: Activity, s: Status) => void;
  disabled: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  return (
    <DndContext
      sensors={sensors}
      onDragEnd={(e) => {
        const a = items.find((a) => a.id === e.active.id);
        if (
          a &&
          e.over &&
          statuses.includes(e.over.id as Status) &&
          a.status !== e.over.id
        )
          onMove(a, e.over.id as Status);
      }}
    >
      <div className="kanban">
        {statuses.map((s) => (
          <Column
            key={s}
            status={s}
            items={items.filter((a) => a.status === s)}
            onOpen={onOpen}
            disabled={disabled}
          />
        ))}
      </div>
    </DndContext>
  );
}
